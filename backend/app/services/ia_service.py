import json
import re
import time
from typing import Dict, Any, Optional, Callable, List
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.schemas.uml import TIPOS_RELACION_VALIDOS
from app.schemas.ia import IAPrecisionProposal, IAGenerateResponse
from app.services.diagrama_service import DiagramaService


SYSTEM_PROMPT = """Eres el asistente de arquitectura de ClassFlow AI, una herramienta CASE especializada exclusivamente en diagramas de clases UML para backend Java + Spring Boot.
Tu tarea es interpretar la instrucción en lenguaje natural del usuario y generar una propuesta estructurada en formato JSON estricto.

Reglas obligatorias:
1. Responde ÚNICAMENTE con un objeto JSON válido, sin explicaciones ni markdown alrededor.
2. La estructura debe contener exactamente las llaves "classes" y "relations":
{
  "classes": [
    {
      "nombre": "NombreClase",
      "estereotipo": "«entity»",
      "visibilidad": "public",
      "es_abstracta": false,
      "atributos": [
        {
          "nombre": "id",
          "tipo_dato": "Long",
          "visibilidad": "private",
          "valor_defecto": null,
          "es_estatico": false,
          "es_final": false,
          "es_nullable": false
        }
      ],
      "metodos": [
        {
          "nombre": "metodoEjemplo",
          "tipo_retorno": "void",
          "visibilidad": "public",
          "es_estatico": false,
          "es_abstracto": false,
          "parametros": [
            {
              "nombre": "param1",
              "tipo_dato": "String",
              "valor_defecto": null
            }
          ]
        }
      ]
    }
  ],
  "relations": [
    {
      "origen": "ClaseOrigen",
      "destino": "ClaseDestino",
      "tipo": "asociacion",
      "nombre": "nombreRelacionOpcional",
      "multiplicidad_origen": "1",
      "multiplicidad_destino": "0..*",
      "rol_origen": null,
      "rol_destino": null,
      "navegabilidad_origen": false,
      "navegabilidad_destino": true
    }
  ]
}
3. Los ÚNICOS tipos de relación válidos en ClassFlow AI son:
   - "asociacion"
   - "agregacion"
   - "composicion"
   - "herencia"
   - "dependencia"
   - "realizacion"
   Cualquier otro tipo causará rechazo inmediato.
4. Manejo de clases existentes vs clases nuevas:
   - Si se informa de clases ya existentes en el diagrama, son referencias válidas para conectar relaciones.
   - NO incluyas clases existentes dentro del arreglo "classes" cuando la instrucción solo pida relacionarlas o utilizarlas como referencias.
   - En "classes" debes incluir ÚNICAMENTE las clases NUEVAS que deban ser creadas en el diagrama.
   - Si la instrucción pide únicamente crear relaciones entre clases existentes, el arreglo "classes" debe ser un arreglo vacío [].
   - Las clases existentes pueden y deben usarse directamente en "relations.origen" y "relations.destino".
5. Usa nombres claros en PascalCase para clases y camelCase para atributos/métodos.
6. Los atributos y métodos deben usar tipos de datos comunes de Java (Long, String, Integer, Double, Boolean, LocalDate, BigDecimal, void).
"""


class IAService:
    MAX_RETRIES = 3
    TRANSIENT_STATUS_CODES = {status.HTTP_503_SERVICE_UNAVAILABLE, status.HTTP_429_TOO_MANY_REQUESTS}

    # Hooks de sustitución para pruebas automáticas (evita llamadas reales a internet y gastos de API)
    _mock_client: Optional[Callable[[str], str]] = None
    _mock_transport: Optional[Callable[[str, dict], httpx.Response]] = None
    _backoff_factor: float = 1.0

    @classmethod
    def set_mock_client(cls, mock_fn: Optional[Callable[[str], str]]):
        """Permite inyectar un mock que devuelve la respuesta textual directa."""
        cls._mock_client = mock_fn

    @classmethod
    def set_mock_transport(
        cls,
        transport_fn: Optional[Callable[[str, dict], httpx.Response]],
        backoff_factor: float = 0.0,
    ):
        """Permite inyectar un mock a nivel HTTP para probar reintentos, 503, 404, etc., sin retardos."""
        cls._mock_transport = transport_fn
        cls._backoff_factor = backoff_factor

    @classmethod
    def reset_mocks(cls):
        """Restablece los mocks al estado original de producción."""
        cls._mock_client = None
        cls._mock_transport = None
        cls._backoff_factor = 1.0

    @classmethod
    def _build_existing_classes_context(cls, existing_classes: List[ClaseUML]) -> str:
        """Construye un resumen conciso de las clases existentes para orientar a la IA."""
        if not existing_classes:
            return ""
        lines = [
            "--- CONTEXTO DEL DIAGRAMA ACTUAL ---",
            "Clases ya existentes en el diagrama:",
        ]
        for c in existing_classes:
            attrs = [f"{a.nombre}: {a.tipo_dato}" for a in c.atributos]
            attr_str = f" [atributos: {', '.join(attrs)}]" if attrs else ""
            lines.append(f"- {c.nombre}{attr_str}")
        lines.extend([
            "",
            "INSTRUCCIONES SOBRE CLASES EXISTENTES:",
            "1. Las clases listadas arriba YA existen en este diagrama.",
            "2. NO las incluyas en el arreglo 'classes' si solo se están relacionando o referenciando.",
            "3. En 'classes' incluye ÚNICAMENTE clases NUEVAS que deban ser creadas. Si no se crean clases nuevas, devuelve 'classes': [].",
            "4. En 'relations.origen' y 'relations.destino' puedes usar tanto las clases existentes como las clases nuevas creadas.",
        ])
        return "\n".join(lines)

    @classmethod
    def _call_gemini_api(cls, prompt: str, existing_classes_context: str = "") -> str:
        """Invoca la API de Google Gemini en backend de forma segura y directa, con retry transitorio."""
        if cls._mock_client is not None:
            return cls._mock_client(prompt)

        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "GEMINI_API_KEY no está configurada en el backend. "
                    "Por favor defina GEMINI_API_KEY en backend/.env para habilitar la generación por IA."
                ),
            )

        model = settings.GEMINI_MODEL or "gemini-3.6-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"

        user_content = prompt
        if existing_classes_context:
            user_content = f"{prompt}\n\n{existing_classes_context}"

        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "parts": [{"text": user_content}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        }

        last_transient_detail = "Error transitorio"

        for attempt in range(1, cls.MAX_RETRIES + 1):
            try:
                if cls._mock_transport is not None:
                    response = cls._mock_transport(url, payload)
                else:
                    with httpx.Client(timeout=30.0) as client:
                        response = client.post(url, json=payload)
            except httpx.RequestError as exc:
                last_transient_detail = f"Error de red: {str(exc)}"
                if attempt < cls.MAX_RETRIES:
                    delay = (1.0 if attempt == 1 else 2.0) * cls._backoff_factor
                    if delay > 0:
                        time.sleep(delay)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Error de red persistente al conectar con Gemini tras {cls.MAX_RETRIES} intentos: {str(exc)}",
                )

            # Éxito (HTTP 200)
            if response.status_code == 200:
                try:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ValueError("Respuesta vacía de Gemini")
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if not parts or "text" not in parts[0]:
                        raise ValueError("Contenido no encontrado en la respuesta de Gemini")
                    return parts[0]["text"]
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"No se pudo extraer la respuesta textual de Gemini: {str(exc)}",
                    )

            # Errores transitorios (503 / 429) -> reintentar con exponential backoff
            if response.status_code in cls.TRANSIENT_STATUS_CODES:
                error_msg = response.text
                try:
                    err_json = response.json()
                    if "error" in err_json and "message" in err_json["error"]:
                        error_msg = err_json["error"]["message"]
                except Exception:
                    pass

                last_transient_detail = f"HTTP {response.status_code}: {error_msg}"
                if attempt < cls.MAX_RETRIES:
                    delay = (1.0 if attempt == 1 else 2.0) * cls._backoff_factor
                    if delay > 0:
                        time.sleep(delay)
                    continue

                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        f"El servicio de IA de Gemini no se encuentra disponible temporalmente tras {cls.MAX_RETRIES} intentos "
                        f"debido a alta demanda ({response.status_code}). Por favor, intenta de nuevo en unos momentos."
                    ),
                )

            # Errores permanentes (400, 401, 403, 404, etc.) -> NO reintentar
            error_detail = response.text
            try:
                err_json = response.json()
                if "error" in err_json and "message" in err_json["error"]:
                    error_detail = err_json["error"]["message"]
            except Exception:
                pass

            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        f"El modelo configurado '{model}' no está disponible o no existe en Gemini API (404). "
                        f"Verifica la variable GEMINI_MODEL en backend/.env. Detalle: {error_detail}"
                    ),
                )

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini API devolvió error permanente ({response.status_code}): {error_detail}",
            )

    @classmethod
    def _clean_and_parse_json(cls, raw_text: str) -> Dict[str, Any]:
        """Limpia markdown fences y parsea JSON garantizando que sea una estructura de diccionario."""
        cleaned = raw_text.strip()
        # Eliminar posibles bloques de markdown ```json ... ```
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La IA produjo un formato de texto que no es JSON válido: {str(exc)}",
            )

        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La respuesta estructurada de la IA debe ser un objeto JSON con 'classes' y 'relations'.",
            )

        return parsed

    @classmethod
    def generar_y_aplicar_propuesta(
        cls,
        db: Session,
        diagrama_id: int,
        user_id: int,
        prompt: str,
    ) -> IAGenerateResponse:
        """
        Ejecuta el flujo completo de CU05:
        1. Autorización estricta (propietario o invitado con permiso_edicion).
        2. Invocación a Gemini API.
        3. Extracción y parseo JSON.
        4. Validación Pydantic estricta.
        5. Validaciones de dominio UML (existencia de clases, tipos soportados, sin duplicados).
        6. Transacción atómica de persistencia (INSERT clases, atributos, métodos, parámetros, relaciones).
        7. COMMIT PostgreSQL.
        8. Notificación WebSocket diagram.changed (CU04).
        """
        # 1. Autorización obligatoria en backend
        diagrama, es_propietario, permiso_edicion = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )

        # Clases ya existentes en este diagrama (para contexto IA y validaciones)
        existing_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).all()
        existing_names = {c.nombre.strip().lower(): c for c in existing_classes}
        context_str = cls._build_existing_classes_context(existing_classes)

        # 2. Llamada al proveedor externo (IA) con contexto de clases existentes
        raw_response = cls._call_gemini_api(prompt, existing_classes_context=context_str)

        # 3. Limpieza y parseo JSON
        json_data = cls._clean_and_parse_json(raw_response)

        # 4. Validación mediante Pydantic
        try:
            proposal = IAPrecisionProposal.model_validate(json_data)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Estructura UML de la IA inválida según el esquema: {str(exc)}",
            )

        if not proposal.classes and not proposal.relations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La IA no propuso ninguna clase ni relación para agregar al diagrama.",
            )

        # 5. Validaciones de Dominio UML
        # Clasificar clases propuestas: nuevas a crear vs referencias existentes seguras
        classes_to_create: List[Any] = []
        new_class_names_seen: set = set()

        for cl in proposal.classes:
            name_clean = cl.nombre.strip()
            if not name_clean:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La propuesta contiene una clase con nombre vacío.",
                )
            name_lower = name_clean.lower()

            if name_lower not in existing_names:
                # Es una clase NUEVA
                if name_lower in new_class_names_seen:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La propuesta de la IA contiene clases duplicadas con el nombre '{name_clean}'.",
                    )
                new_class_names_seen.add(name_lower)
                classes_to_create.append(cl)
            else:
                # La clase YA EXISTE en este diagrama.
                # Verificamos si es una referencia válida para conectar relaciones o una colisión/recreación no permitida.
                is_referenced_in_rel = any(
                    rel.origen.strip().lower() == name_lower or rel.destino.strip().lower() == name_lower
                    for rel in proposal.relations
                )
                if not is_referenced_in_rel:
                    # No participa en ninguna relación propuesta -> intento de recrear clase existente
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La clase '{name_clean}' ya existe en este diagrama. No se permiten nombres duplicados.",
                    )

                db_class = existing_names[name_lower]
                existing_attrs = {a.nombre.strip().lower() for a in db_class.atributos}
                existing_methods = {m.nombre.strip().lower() for m in db_class.metodos}

                prop_attrs = {a.nombre.strip().lower() for a in cl.atributos}
                prop_methods = {m.nombre.strip().lower() for m in cl.metodos}

                new_attrs = prop_attrs - existing_attrs
                new_methods = prop_methods - existing_methods

                if new_attrs or new_methods:
                    # Intenta introducir atributos o métodos nuevos/incompatibles de forma implícita
                    incompatibles = sorted(new_attrs | new_methods)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"La clase '{name_clean}' ya existe en este diagrama y la propuesta incluye miembros "
                            f"incompatibles o nuevos ({', '.join(incompatibles)}). No se permite modificar clases "
                            f"existentes de forma implícita."
                        ),
                    )

                # Si es una referencia segura (prop_attrs <= existing_attrs y prop_methods <= existing_methods)
                # y participa en relaciones, NO se añade a classes_to_create y se respeta la clase existente intacta.

        if not classes_to_create and not proposal.relations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La propuesta no contiene elementos nuevos para agregar al diagrama.",
            )

        # Validar relaciones (origen y destino deben existir en las propuestas nuevas o en las existentes)
        all_available_classes = new_class_names_seen | set(existing_names.keys())
        for rel in proposal.relations:
            orig_lower = rel.origen.strip().lower()
            dest_lower = rel.destino.strip().lower()

            if orig_lower not in all_available_classes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Relación inválida: la clase origen '{rel.origen}' no existe en el diagrama ni en la propuesta.",
                )
            if dest_lower not in all_available_classes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Relación inválida: la clase destino '{rel.destino}' no existe en el diagrama ni en la propuesta.",
                )

            tipo_clean = rel.tipo.strip().lower()
            if tipo_clean not in TIPOS_RELACION_VALIDOS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tipo de relación no admitido: '{rel.tipo}'. Solo se admiten: {list(TIPOS_RELACION_VALIDOS)}.",
                )

        # 6. Transacción Atómica de Persistencia
        created_class_names: List[str] = []
        created_relations_count = 0

        try:
            # Posicionamiento inicial determinista para clases NUEVAS
            base_idx = len(existing_classes)
            name_to_db_id: Dict[str, int] = {k: v.id_clase for k, v in existing_names.items()}

            for idx, c_prop in enumerate(classes_to_create):
                col = (base_idx + idx) % 3
                row = (base_idx + idx) // 3
                pos_x = 80 + col * 320
                pos_y = 80 + row * 260

                db_clase = ClaseUML(
                    id_diagrama=diagrama_id,
                    nombre=c_prop.nombre.strip(),
                    estereotipo=c_prop.estereotipo or "«entity»",
                    visibilidad=c_prop.visibilidad or "public",
                    es_abstracta=c_prop.es_abstracta,
                    posicion_x=pos_x,
                    posicion_y=pos_y,
                    ancho=260,
                    alto=180,
                )
                db.add(db_clase)
                db.flush()  # Obtener id_clase generado

                name_to_db_id[c_prop.nombre.strip().lower()] = db_clase.id_clase
                created_class_names.append(db_clase.nombre)

                # Atributos de la clase
                for ord_a, attr in enumerate(c_prop.atributos):
                    db_attr = AtributoUML(
                        id_clase=db_clase.id_clase,
                        nombre=attr.nombre.strip(),
                        tipo_dato=attr.tipo_dato.strip() if attr.tipo_dato else "String",
                        visibilidad=attr.visibilidad or "private",
                        valor_defecto=attr.valor_defecto,
                        es_estatico=attr.es_estatico,
                        es_final=attr.es_final,
                        es_nullable=attr.es_nullable,
                        orden=ord_a,
                    )
                    db.add(db_attr)

                # Métodos y parámetros de la clase
                for ord_m, met in enumerate(c_prop.metodos):
                    db_met = MetodoUML(
                        id_clase=db_clase.id_clase,
                        nombre=met.nombre.strip(),
                        tipo_retorno=met.tipo_retorno.strip() if met.tipo_retorno else "void",
                        visibilidad=met.visibilidad or "public",
                        es_estatico=met.es_estatico,
                        es_abstracto=met.es_abstracto,
                        orden=ord_m,
                    )
                    db.add(db_met)
                    db.flush()

                    for ord_p, param in enumerate(met.parametros):
                        db_param = ParametroUML(
                            id_metodo=db_met.id_metodo,
                            nombre=param.nombre.strip(),
                            tipo_dato=param.tipo_dato.strip() if param.tipo_dato else "String",
                            valor_defecto=param.valor_defecto,
                            orden=ord_p,
                        )
                        db.add(db_param)

            # Persistir relaciones
            for rel_prop in proposal.relations:
                orig_id = name_to_db_id[rel_prop.origen.strip().lower()]
                dest_id = name_to_db_id[rel_prop.destino.strip().lower()]

                db_rel = RelacionUML(
                    id_diagrama=diagrama_id,
                    id_clase_origen=orig_id,
                    id_clase_destino=dest_id,
                    tipo=rel_prop.tipo.strip().lower(),
                    nombre=rel_prop.nombre.strip() if rel_prop.nombre else None,
                    multiplicidad_origen=rel_prop.multiplicidad_origen or "1",
                    multiplicidad_destino=rel_prop.multiplicidad_destino or "1",
                    rol_origen=rel_prop.rol_origen,
                    rol_destino=rel_prop.rol_destino,
                    navegabilidad_origen=rel_prop.navegabilidad_origen,
                    navegabilidad_destino=rel_prop.navegabilidad_destino,
                )
                db.add(db_rel)
                created_relations_count += 1

            # 7. COMMIT en PostgreSQL
            db.commit()

        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Fallo durante la persistencia de la propuesta IA: {str(exc)}",
            )

        # 8. Notificación WebSocket diagram.changed (SOLO después del COMMIT exitoso)
        DiagramaService._notify_diagram_changed(diagrama_id, user_id)

        # Totales actualizados
        total_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).count()
        total_relations = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).count()

        return IAGenerateResponse(
            success=True,
            message=(
                f"Propuesta IA aplicada exitosamente: {len(created_class_names)} clases y "
                f"{created_relations_count} relaciones persistidas en PostgreSQL."
            ),
            prompt=prompt,
            created_classes=created_class_names,
            created_relations=created_relations_count,
            total_classes=total_classes,
            total_relations=total_relations,
        )
