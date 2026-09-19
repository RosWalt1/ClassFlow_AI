import json
import unicodedata
from decimal import Decimal
from typing import Dict, Any, Optional, Callable, List
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, RelacionUML
from app.schemas.uml import TIPOS_RELACION_VALIDOS
from app.schemas.voice import (
    VoiceCommandOperation,
    VoiceCommandResponse,
    AddClassData,
    AddAttributeData,
    RemoveAttributeData,
    CreateRelationData,
)
from app.services.diagrama_service import DiagramaService
from app.services.voice_parser import DeterministicVoiceParser, normalize_accents


def _normalize_str(text: str) -> str:
    """Elimina acentos y convierte a minúsculas para comparaciones robustas."""
    return normalize_accents(text)


class VoiceService:
    """
    Servicio central de comandos de voz para ClassFlow AI (CU06).
    Utiliza SpeechRecognition en navegador para STT y DeterministicVoiceParser
    en backend para extracción determinista de intenciones UML, persistiendo
    en PostgreSQL con transacciones atómicas y notificación WebSocket.
    """

    _mock_client: Optional[Callable[[str], str]] = None

    @classmethod
    def set_mock_client(cls, mock_fn: Optional[Callable[[str], str]]):
        """Inyecta un mock para pruebas textuales de comandos de voz."""
        cls._mock_client = mock_fn

    @classmethod
    def reset_mocks(cls):
        """Restablece los mocks de VoiceService."""
        cls._mock_client = None

    @classmethod
    def _parse_and_validate_json_response(cls, raw_text: str) -> Dict[str, Any]:
        """Valida formato JSON para mocks de testing."""
        try:
            return json.loads(raw_text.strip())
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Respuesta inválida: no produjo un JSON válido ({str(exc)})",
            )

    @classmethod
    def _ejecutar_propuesta_validada(
        cls,
        db: Session,
        diagrama_id: int,
        user_id: int,
        transcripcion: str,
        parsed_dict: Dict[str, Any],
        existing_classes: List[ClaseUML],
    ) -> VoiceCommandResponse:
        """Valida semántica de negocio UML y ejecuta mutación atómica en PostgreSQL."""
        if "error" in parsed_dict and parsed_dict["error"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=parsed_dict["error"],
            )

        op_name = parsed_dict.get("operation")
        op_data = parsed_dict.get("data") or {}

        if not op_name or op_name not in [op.value for op in VoiceCommandOperation]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Operación de voz no reconocida: '{op_name}'. "
                    f"Operaciones soportadas: {[op.value for op in VoiceCommandOperation]}."
                ),
            )

        result_message = ""
        detalles: Dict[str, Any] = {}

        try:
            if op_name == VoiceCommandOperation.ADD_CLASS.value:
                validated_class = AddClassData(**op_data)
                nombre_c = validated_class.nombre.strip()
                if not nombre_c:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El nombre de la clase a crear no puede estar vacío.",
                    )

                for ec in existing_classes:
                    if ec.nombre.strip().lower() == nombre_c.lower():
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Ya existe una clase llamada '{nombre_c}' en este diagrama.",
                        )

                idx = len(existing_classes)
                pos_x = 80 + (idx % 3) * 320
                pos_y = 80 + (idx // 3) * 260

                nueva_clase = ClaseUML(
                    id_diagrama=diagrama_id,
                    nombre=nombre_c,
                    estereotipo=validated_class.estereotipo or "«entity»",
                    visibilidad=validated_class.visibilidad or "public",
                    es_abstracta=False,
                    posicion_x=Decimal(str(pos_x)),
                    posicion_y=Decimal(str(pos_y)),
                    ancho=Decimal("260"),
                    alto=Decimal("180"),
                )
                db.add(nueva_clase)
                db.flush()

                default_id = AtributoUML(
                    id_clase=nueva_clase.id_clase,
                    nombre="id",
                    tipo_dato="Long",
                    visibilidad="private",
                    orden=0,
                )
                db.add(default_id)

                detalles = {
                    "id_clase": nueva_clase.id_clase,
                    "nombre": nueva_clase.nombre,
                    "estereotipo": nueva_clase.estereotipo,
                }
                result_message = f"Clase '{nueva_clase.nombre}' agregada exitosamente mediante comando de voz."

            elif op_name == VoiceCommandOperation.ADD_ATTRIBUTE.value:
                validated_attr = AddAttributeData(**op_data)
                clase_nom = validated_attr.clase_nombre.strip()
                attr_nom = validated_attr.nombre.strip()
                tipo_nom = (validated_attr.tipo_dato or "String").strip()
                vis_nom = validated_attr.visibilidad or "private"

                target_clase: Optional[ClaseUML] = None
                for ec in existing_classes:
                    if _normalize_str(ec.nombre) == _normalize_str(clase_nom):
                        target_clase = ec
                        break

                if not target_clase:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede agregar el atributo: la clase '{clase_nom}' no existe en este diagrama.",
                    )

                for ea in target_clase.atributos:
                    if _normalize_str(ea.nombre) == _normalize_str(attr_nom):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"El atributo '{attr_nom}' ya existe en la clase '{target_clase.nombre}'.",
                        )

                nuevo_attr = AtributoUML(
                    id_clase=target_clase.id_clase,
                    nombre=attr_nom,
                    tipo_dato=tipo_nom,
                    visibilidad=vis_nom,
                    orden=len(target_clase.atributos),
                )
                db.add(nuevo_attr)

                detalles = {
                    "id_clase": target_clase.id_clase,
                    "clase_nombre": target_clase.nombre,
                    "atributo": attr_nom,
                    "tipo_dato": tipo_nom,
                }
                result_message = (
                    f"Atributo '{attr_nom}: {tipo_nom}' agregado a la clase '{target_clase.nombre}' "
                    "mediante comando de voz."
                )

            elif op_name == VoiceCommandOperation.REMOVE_ATTRIBUTE.value:
                validated_rem = RemoveAttributeData(**op_data)
                clase_nom = validated_rem.clase_nombre.strip()
                attr_nom = validated_rem.nombre.strip()

                target_clase: Optional[ClaseUML] = None
                for ec in existing_classes:
                    if _normalize_str(ec.nombre) == _normalize_str(clase_nom):
                        target_clase = ec
                        break

                if not target_clase:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede eliminar el atributo: la clase '{clase_nom}' no existe en este diagrama.",
                    )

                target_attr: Optional[AtributoUML] = None
                for ea in target_clase.atributos:
                    if _normalize_str(ea.nombre) == _normalize_str(attr_nom):
                        target_attr = ea
                        break

                if not target_attr:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El atributo '{attr_nom}' no existe en la clase '{target_clase.nombre}'.",
                    )

                detalles = {
                    "id_clase": target_clase.id_clase,
                    "clase_nombre": target_clase.nombre,
                    "id_atributo": target_attr.id_atributo,
                    "atributo_eliminado": target_attr.nombre,
                }
                db.delete(target_attr)
                result_message = (
                    f"Atributo '{target_attr.nombre}' eliminado de la clase '{target_clase.nombre}' "
                    "mediante comando de voz."
                )

            elif op_name == VoiceCommandOperation.CREATE_RELATION.value:
                validated_rel = CreateRelationData(**op_data)
                orig_name = validated_rel.origen.strip()
                dest_name = validated_rel.destino.strip()
                rel_type = (validated_rel.tipo or "asociacion").lower().strip()

                if rel_type not in TIPOS_RELACION_VALIDOS:
                    rel_type = "asociacion"

                orig_clase: Optional[ClaseUML] = None
                dest_clase: Optional[ClaseUML] = None

                for ec in existing_classes:
                    if _normalize_str(ec.nombre) == _normalize_str(orig_name):
                        orig_clase = ec
                    if _normalize_str(ec.nombre) == _normalize_str(dest_name):
                        dest_clase = ec

                if not orig_clase:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede crear relación: la clase origen '{orig_name}' no existe en este diagrama.",
                    )
                if not dest_clase:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede crear relación: la clase destino '{dest_name}' no existe en este diagrama.",
                    )

                nueva_rel = RelacionUML(
                    id_diagrama=diagrama_id,
                    id_clase_origen=orig_clase.id_clase,
                    id_clase_destino=dest_clase.id_clase,
                    tipo=rel_type,
                    nombre=validated_rel.nombre,
                    multiplicidad_origen=validated_rel.multiplicidad_origen or "1",
                    multiplicidad_destino=validated_rel.multiplicidad_destino or "0..*",
                )
                db.add(nueva_rel)

                detalles = {
                    "origen": orig_clase.nombre,
                    "destino": dest_clase.nombre,
                    "tipo": rel_type,
                    "multiplicidad_origen": nueva_rel.multiplicidad_origen,
                    "multiplicidad_destino": nueva_rel.multiplicidad_destino,
                }
                result_message = (
                    f"Relación '{rel_type}' creada exitosamente entre '{orig_clase.nombre}' y '{dest_clase.nombre}' "
                    f"({nueva_rel.multiplicidad_origen} a {nueva_rel.multiplicidad_destino})."
                )

            # Persistencia atómica
            db.commit()

        except (HTTPException, ValidationError) as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Datos de operación inválidos: {str(exc)}",
            )
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al persistir el comando de voz: {str(exc)}",
            )

        # Emitir WebSocket diagram.changed ÚNICAMENTE tras el COMMIT
        DiagramaService._notify_diagram_changed(diagrama_id, user_id)

        total_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).count()
        total_relations = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).count()

        return VoiceCommandResponse(
            success=True,
            message=result_message,
            transcripcion=transcripcion,
            operation=op_name,
            detalles=detalles,
            total_classes=total_classes,
            total_relations=total_relations,
        )

    @classmethod
    def procesar_comando_voz(
        cls,
        db: Session,
        diagrama_id: int,
        user_id: int,
        transcripcion: str,
    ) -> VoiceCommandResponse:
        """Procesa una orden de voz textual utilizando exclusivamente el parser determinista."""
        transcripcion_limpia = DeterministicVoiceParser.clean_text(transcripcion)
        if not transcripcion_limpia:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La transcripción de voz está vacía.",
            )

        DiagramaService.get_diagrama_permiso(db, diagrama_id, user_id, require_edit=True)

        existing_classes = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_diagrama == diagrama_id)
            .all()
        )

        if cls._mock_client is not None:
            raw_mock = cls._mock_client(transcripcion_limpia)
            try:
                parsed_dict = cls._parse_and_validate_json_response(raw_mock)
            except Exception:
                parsed_dict = DeterministicVoiceParser.parse(transcripcion_limpia)
        else:
            parsed_dict = DeterministicVoiceParser.parse(transcripcion_limpia)

        return cls._ejecutar_propuesta_validada(
            db=db,
            diagrama_id=diagrama_id,
            user_id=user_id,
            transcripcion=transcripcion_limpia,
            parsed_dict=parsed_dict,
            existing_classes=existing_classes,
        )
