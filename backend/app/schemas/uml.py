from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ==========================================
# PARÁMETRO UML SCHEMAS
# ==========================================
class ParametroUMLBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_dato: str = Field(..., min_length=1, max_length=100)
    valor_defecto: Optional[str] = Field(None, max_length=100)
    orden: int = Field(0, ge=0)


class ParametroUMLCreate(ParametroUMLBase):
    pass


class ParametroUMLUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo_dato: Optional[str] = Field(None, min_length=1, max_length=100)
    valor_defecto: Optional[str] = Field(None, max_length=100)
    orden: Optional[int] = Field(None, ge=0)


class ParametroUMLResponse(ParametroUMLBase):
    id_parametro: int
    id_metodo: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# MÉTODO UML SCHEMAS
# ==========================================
class MetodoUMLBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_retorno: str = Field("void", min_length=1, max_length=100)
    visibilidad: str = Field("public", max_length=20)
    es_estatico: bool = False
    es_abstracto: bool = False
    orden: int = Field(0, ge=0)


class MetodoUMLCreate(MetodoUMLBase):
    pass


class MetodoUMLUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo_retorno: Optional[str] = Field(None, min_length=1, max_length=100)
    visibilidad: Optional[str] = Field(None, max_length=20)
    es_estatico: Optional[bool] = None
    es_abstracto: Optional[bool] = None
    orden: Optional[int] = Field(None, ge=0)


class MetodoUMLResponse(MetodoUMLBase):
    id_metodo: int
    id_clase: int
    parametros: List[ParametroUMLResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# ATRIBUTO UML SCHEMAS
# ==========================================
class AtributoUMLBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo_dato: str = Field(..., min_length=1, max_length=100)
    visibilidad: str = Field("private", max_length=20)
    valor_defecto: Optional[str] = Field(None, max_length=100)
    es_estatico: bool = False
    es_final: bool = False
    es_nullable: bool = True
    orden: int = Field(0, ge=0)


class AtributoUMLCreate(AtributoUMLBase):
    pass


class AtributoUMLUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo_dato: Optional[str] = Field(None, min_length=1, max_length=100)
    visibilidad: Optional[str] = Field(None, max_length=20)
    valor_defecto: Optional[str] = Field(None, max_length=100)
    es_estatico: Optional[bool] = None
    es_final: Optional[bool] = None
    es_nullable: Optional[bool] = None
    orden: Optional[int] = Field(None, ge=0)


class AtributoUMLResponse(AtributoUMLBase):
    id_atributo: int
    id_clase: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# CLASE UML SCHEMAS
# ==========================================
class ClaseUMLBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    estereotipo: Optional[str] = Field(None, max_length=50)
    visibilidad: str = Field("public", max_length=20)
    es_abstracta: bool = False
    posicion_x: float = 0.0
    posicion_y: float = 0.0
    ancho: float = 220.0
    alto: float = 150.0


class ClaseUMLCreate(ClaseUMLBase):
    pass


class ClaseUMLUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    estereotipo: Optional[str] = Field(None, max_length=50)
    visibilidad: Optional[str] = Field(None, max_length=20)
    es_abstracta: Optional[bool] = None
    ancho: Optional[float] = None
    alto: Optional[float] = None


class ClaseUMLPosicionUpdate(BaseModel):
    posicion_x: float
    posicion_y: float


class ClaseUMLResponse(ClaseUMLBase):
    id_clase: int
    id_diagrama: int
    fecha_creacion: datetime
    fecha_modificacion: datetime
    atributos: List[AtributoUMLResponse] = []
    metodos: List[MetodoUMLResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# RELACIÓN UML SCHEMAS
# ==========================================
TIPOS_RELACION_VALIDOS = (
    "asociacion",
    "agregacion",
    "composicion",
    "herencia",
    "dependencia",
    "realizacion",
)


class RelacionUMLBase(BaseModel):
    id_clase_origen: int
    id_clase_destino: int
    tipo: str = Field(..., max_length=50)
    nombre: Optional[str] = Field(None, max_length=100)
    multiplicidad_origen: Optional[str] = Field(None, max_length=20)
    multiplicidad_destino: Optional[str] = Field(None, max_length=20)
    rol_origen: Optional[str] = Field(None, max_length=100)
    rol_destino: Optional[str] = Field(None, max_length=100)
    navegabilidad_origen: bool = False
    navegabilidad_destino: bool = True


class RelacionUMLCreate(RelacionUMLBase):
    pass


class RelacionUMLUpdate(BaseModel):
    tipo: Optional[str] = Field(None, max_length=50)
    nombre: Optional[str] = Field(None, max_length=100)
    multiplicidad_origen: Optional[str] = Field(None, max_length=20)
    multiplicidad_destino: Optional[str] = Field(None, max_length=20)
    rol_origen: Optional[str] = Field(None, max_length=100)
    rol_destino: Optional[str] = Field(None, max_length=100)
    navegabilidad_origen: Optional[bool] = None
    navegabilidad_destino: Optional[bool] = None


class RelacionUMLResponse(RelacionUMLBase):
    id_relacion: int
    id_diagrama: int
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# DIAGRAMA SCHEMAS
# ==========================================
class DiagramaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=150)
    descripcion: Optional[str] = Field(None, max_length=500)


class DiagramaResponse(BaseModel):
    id_diagrama: int
    id_proyecto: int
    nombre: str
    descripcion: Optional[str] = None
    version: int
    fecha_creacion: datetime
    fecha_modificacion: datetime
    es_propietario: bool = False
    permiso_edicion: bool = False
    clases: List[ClaseUMLResponse] = []
    relaciones: List[RelacionUMLResponse] = []

    model_config = ConfigDict(from_attributes=True)
