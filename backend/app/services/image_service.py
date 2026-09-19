import base64
import json
import os
import time
from typing import Dict, Any, List
from fastapi import HTTPException, UploadFile, status
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.schemas.uml import TIPOS_RELACION_VALIDOS
from app.schemas.ia import IAPrecisionProposal, ImageApplyResponse
from app.services.diagrama_service import DiagramaService


SYSTEM_PROMPT_IMAGE = """Eres el motor de reconocimiento visual de ClassFlow AI, una herramienta CASE especializada exclusivamente en diagramas de clases UML para backend Java + Spring Boot.
Tu tarea es analizar la fotografía o imagen proporcionada (que puede ser un diagrama de clases dibujado a mano en un pizarrón, en papel o digital) y extraer EXCLUSIVAMENTE su modelo de clases UML en formato JSON estricto.

Reglas obligatorias:
1. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni explicaciones adicionales.
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
          "nombre": "nombreAtributo",
          "tipo_dato": "String",
          "visibilidad": "private",
          "valor_defecto": null,
          "es_estatico": false,
          "es_final": false,
          "es_nullable": true
        }
      ],
      "metodos": [
        {
          "nombre": "nombreMetodo",
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
      "nombre": null,
      "multiplicidad_origen": "1",
      "multiplicidad_destino": "0..*",
      "rol_origen": null,
      "rol_destino": null,
      "navegabilidad_origen": false,
      "navegabilidad_destino": true
    }
  ]
}
3. Reconoce únicamente elementos UML:
   - Nombres de clases en PascalCase.
   - Atributos con su visibilidad (+ public, - private, # protected, ~ package) y tipo Java estándar (Long, Integer, String, Double, Boolean, LocalDate, BigDecimal).
   - Métodos con sus parámetros y tipo de retorno.
   - Relaciones entre clases con sus multiplicidades (1, 0..1, 1..*, 0..*, *).
4. Tipos oficiales de relación admitidos en ClassFlow AI:
   - "asociacion"
   - "agregacion"
   - "composicion"
   - "herencia"
   - "dependencia"
   - "realizacion"
5. Si la imagen NO representa un diagrama de clases UML (por ejemplo, es un diagrama de flujo, diagrama de secuencia, paisaje, texto arbitrario o imagen ilegible), devuelve:
   {"classes": [], "relations": []}
"""

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg"}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class ImageService:
    MAX_RETRIES = 3
    TRANSIENT_STATUS_CODES = {status.HTTP_503_SERVICE_UNAVAILABLE, status.HTTP_429_TOO_MANY_REQUESTS}

    @classmethod
    def _call_gemini_multimodal(cls, image_bytes: bytes, mime_type: str) -> str:
        """Llama a la API de Google Gemini en backend con payload multimodal (imagen base64)."""
        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "GEMINI_API_KEY no está configurada en el backend. "
                    "Por favor defina GEMINI_API_KEY en backend/.env para habilitar la importación por imagen."
                ),
            )

        model = settings.GEMINI_MODEL or "gemini-3.6-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"

        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT_IMAGE}]
            },
            "contents": [
                {
                  "parts": [
                    {
                      "text": "Analiza esta fotografía o imagen de un diagrama de clases UML. Identifica y extrae las clases, atributos, métodos y relaciones según las especificaciones."
                    },
                    {
                      "inline_data": {
                        "mime_type": mime_type,
                        "data": b64_image,
                      }
                    }
                  ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        for attempt in range(1, cls.MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=45.0) as client:
                    response = client.post(url, json=payload)
            except httpx.RequestError as exc:
                if attempt < cls.MAX_RETRIES:
                    time.sleep(1.0 if attempt == 1 else 2.0)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Error de red al conectar con Gemini para análisis de imagen: {str(exc)}",
                )

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

            if response.status_code in cls.TRANSIENT_STATUS_CODES:
                if attempt < cls.MAX_RETRIES:
                    time.sleep(1.0 if attempt == 1 else 2.0)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        f"El servicio de Gemini no se encuentra disponible temporalmente tras {cls.MAX_RETRIES} intentos. "
                        "Por favor, intenta nuevamente en unos momentos."
                    ),
                )

            # Error permanente
            error_detail = response.text
            try:
                err_json = response.json()
                if "error" in err_json and "message" in err_json["error"]:
                    error_detail = err_json["error"]["message"]
            except Exception:
                pass

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en Gemini API ({response.status_code}): {error_detail}",
            )

    @classmethod
    def _clean_and_parse_json(cls, raw_text: str) -> Dict[str, Any]:
        """Limpia posibles bloques markdown y parsea JSON."""
        cleaned = raw_text.strip()
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
                detail=f"La respuesta de la IA no contiene JSON válido: {str(exc)}",
            )

        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La respuesta debe ser un objeto JSON con 'classes' y 'relations'.",
            )

        return parsed

    @classmethod
    def analizar_imagen(
        cls,
        db: Session,
        diagrama_id: int,
        user_id: int,
        file: UploadFile,
    ) -> IAPrecisionProposal:
        """
        Fase 1: Recibe la imagen, valida que sea propietario, analiza con Gemini multimodal
        y devuelve la propuesta UML estructurada.
        NO MODIFICA LA BASE DE DATOS.
        """
        # 1. Autorización: SOLO PROPIETARIO
        _, es_propietario, _ = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        if not es_propietario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del proyecto puede importar diagramas desde imágenes.",
            )

        # 2. Validación de archivo (extensión y MIME)
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato de imagen '{ext}' no soportado. Se admiten únicamente imágenes PNG, JPG o JPEG.",
            )

        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_IMAGE_MIMES:
            # Si el content-type viene genérico o coincide con la extensión permitida
            if ext == ".png":
                content_type = "image/png"
            elif ext in [".jpg", ".jpeg"]:
                content_type = "image/jpeg"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tipo MIME '{file.content_type}' no soportado. Se admiten únicamente imágenes PNG o JPG.",
                )

        # 3. Lectura y validación de tamaño
        try:
            image_bytes = file.file.read()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo leer el archivo de imagen: {str(exc)}",
            )

        if not image_bytes or len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo de imagen está vacío.",
            )

        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El tamaño de la imagen ({len(image_bytes) // 1024} KB) excede el límite máximo permitido de 10 MB.",
            )

        # 4. Invocación a Gemini multimodal
        raw_text = cls._call_gemini_multimodal(image_bytes, content_type)

        # 5. Parseo y validación de esquema
        parsed_json = cls._clean_and_parse_json(raw_text)

        try:
            proposal = IAPrecisionProposal.model_validate(parsed_json)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"La estructura del diagrama UML obtenida no es válida: {str(exc)}",
            )

        if not proposal.classes and not proposal.relations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No se pudo interpretar un diagrama de clases UML en la imagen. "
                    "Asegúrate de que la fotografía sea clara y contenga clases UML válidas."
                ),
            )

        return proposal

    @classmethod
    def aplicar_propuesta(
        cls,
        db: Session,
        diagrama_id: int,
        user_id: int,
        proposal: IAPrecisionProposal,
    ) -> ImageApplyResponse:
        """
        Fase 2: Valida la propuesta del usuario y la persiste atómicamente en PostgreSQL.
        SOLO PROPIETARIO.
        Emite diagram.changed tras el commit exitoso.
        """
        # 1. Autorización: SOLO PROPIETARIO
        _, es_propietario, _ = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        if not es_propietario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del proyecto puede importar diagramas desde imágenes.",
            )

        if not proposal.classes and not proposal.relations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La propuesta no contiene elementos para agregar al diagrama.",
            )

        # 2. Validaciones de dominio UML
        existing_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).all()
        existing_names = {c.nombre.strip().lower(): c for c in existing_classes}

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
                if name_lower in new_class_names_seen:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La propuesta contiene clases duplicadas con el nombre '{name_clean}'.",
                    )
                new_class_names_seen.add(name_lower)
                classes_to_create.append(cl)
            else:
                # La clase ya existe: verificar que sea una referencia válida para relaciones
                is_referenced = any(
                    rel.origen.strip().lower() == name_lower or rel.destino.strip().lower() == name_lower
                    for rel in proposal.relations
                )
                if not is_referenced:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"La clase '{name_clean}' ya existe en el diagrama. No se permiten nombres duplicados.",
                    )

        # Validar relaciones (origen y destino deben existir)
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

        # 3. Transacción atómica en PostgreSQL
        created_class_names: List[str] = []
        created_relations_count = 0

        try:
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
                db.flush()

                name_to_db_id[c_prop.nombre.strip().lower()] = db_clase.id_clase
                created_class_names.append(db_clase.nombre)

                # Atributos
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

                # Métodos y parámetros
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

            # Relaciones
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

            # Commit atómico
            db.commit()

        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Fallo durante la persistencia de la propuesta de imagen: {str(exc)}",
            )

        # 4. Notificación WebSocket diagram.changed (SOLO después del commit exitoso)
        DiagramaService._notify_diagram_changed(diagrama_id, user_id)

        # Totales actualizados
        total_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).count()
        total_relations = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).count()

        return ImageApplyResponse(
            success=True,
            message=(
                f"Diagrama desde imagen aplicado exitosamente: {len(created_class_names)} clases y "
                f"{created_relations_count} relaciones persistidas en PostgreSQL."
            ),
            created_classes=created_class_names,
            created_relations=created_relations_count,
            total_classes=total_classes,
            total_relations=total_relations,
        )
