from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.schemas.uml import TIPOS_RELACION_VALIDOS


class IAParametroItem(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_dato: str = Field("String", min_length=1, max_length=100)
    valor_defecto: Optional[str] = Field(None, max_length=100)


class IAMetodoItem(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_retorno: str = Field("void", min_length=1, max_length=100)
    visibilidad: str = Field("public", max_length=20)
    es_estatico: bool = False
    es_abstracto: bool = False
    parametros: List[IAParametroItem] = []


class IAAtributoItem(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_dato: str = Field("String", min_length=1, max_length=100)
    visibilidad: str = Field("private", max_length=20)
    valor_defecto: Optional[str] = Field(None, max_length=100)
    es_estatico: bool = False
    es_final: bool = False
    es_nullable: bool = True


class IAClaseItem(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    estereotipo: Optional[str] = Field(None, max_length=50)
    visibilidad: str = Field("public", max_length=20)
    es_abstracta: bool = False
    atributos: List[IAAtributoItem] = []
    metodos: List[IAMetodoItem] = []


class IARelacionItem(BaseModel):
    origen: str = Field(..., min_length=1, max_length=100)
    destino: str = Field(..., min_length=1, max_length=100)
    tipo: str = Field(..., max_length=50)
    nombre: Optional[str] = Field(None, max_length=100)
    multiplicidad_origen: Optional[str] = Field(None, max_length=20)
    multiplicidad_destino: Optional[str] = Field(None, max_length=20)
    rol_origen: Optional[str] = Field(None, max_length=100)
    rol_destino: Optional[str] = Field(None, max_length=100)
    navegabilidad_origen: bool = False
    navegabilidad_destino: bool = True

    @field_validator("tipo")
    @classmethod
    def validate_tipo_relacion(cls, v: str) -> str:
        cleaned = v.strip().lower() if v else ""
        if cleaned not in TIPOS_RELACION_VALIDOS:
            raise ValueError(
                f"Tipo de relación '{v}' no es válido. Tipos oficiales admitidos: {list(TIPOS_RELACION_VALIDOS)}"
            )
        return cleaned


class IAPrecisionProposal(BaseModel):
    classes: List[IAClaseItem] = []
    relations: List[IARelacionItem] = []


class IAGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)


class IAGenerateResponse(BaseModel):
    success: bool
    message: str
    prompt: str
    created_classes: List[str] = []
    created_relations: int = 0
    total_classes: int = 0
    total_relations: int = 0


class ImageApplyResponse(BaseModel):
    success: bool
    message: str
    created_classes: List[str] = []
    created_relations: int = 0
    total_classes: int = 0
    total_relations: int = 0

