from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator
from app.schemas.uml import TIPOS_RELACION_VALIDOS


class VoiceCommandOperation(str, Enum):
    ADD_CLASS = "add_class"
    ADD_ATTRIBUTE = "add_attribute"
    REMOVE_ATTRIBUTE = "remove_attribute"
    CREATE_RELATION = "create_relation"


class AddClassData(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    estereotipo: Optional[str] = Field("«entity»", max_length=50)
    visibilidad: Optional[str] = Field("public", max_length=20)


class AddAttributeData(BaseModel):
    clase_nombre: str = Field(..., min_length=1, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_dato: Optional[str] = Field("String", max_length=100)
    visibilidad: Optional[str] = Field("private", max_length=20)


class RemoveAttributeData(BaseModel):
    clase_nombre: str = Field(..., min_length=1, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=100)


class CreateRelationData(BaseModel):
    origen: str = Field(..., min_length=1, max_length=100)
    destino: str = Field(..., min_length=1, max_length=100)
    tipo: str = Field("asociacion", max_length=50)
    multiplicidad_origen: Optional[str] = Field("1", max_length=20)
    multiplicidad_destino: Optional[str] = Field("1", max_length=20)
    nombre: Optional[str] = Field(None, max_length=100)

    @field_validator("tipo")
    @classmethod
    def validate_tipo_relacion(cls, v: str) -> str:
        cleaned = v.strip().lower() if v else "asociacion"
        if cleaned not in TIPOS_RELACION_VALIDOS:
            raise ValueError(
                f"Tipo de relación '{v}' no es válido. Tipos oficiales admitidos: {list(TIPOS_RELACION_VALIDOS)}"
            )
        return cleaned


class VoiceCommandProposal(BaseModel):
    operation: VoiceCommandOperation
    data: Dict[str, Any]


class VoiceCommandRequest(BaseModel):
    transcripcion: str = Field(..., min_length=1, max_length=1000)


class VoiceCommandResponse(BaseModel):
    success: bool
    message: str
    transcripcion: str
    operation: str
    detalles: Dict[str, Any] = {}
    total_classes: int = 0
    total_relations: int = 0
