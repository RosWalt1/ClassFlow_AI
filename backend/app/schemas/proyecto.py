from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class ProyectoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150, description="Nombre del proyecto UML")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción del proyecto")


class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=150, description="Nuevo nombre")
    descripcion: Optional[str] = Field(None, max_length=500, description="Nueva descripción")
    estado: Optional[str] = Field(None, pattern="^(activo|archivado)$", description="Estado del proyecto")


class ColaboradorCreate(BaseModel):
    email: EmailStr = Field(..., description="Correo del usuario registrado para invitar como colaborador")
    permiso_edicion: bool = Field(True, description="Si tiene permiso de edición o solo lectura")


class ColaboradorUpdate(BaseModel):
    permiso_edicion: bool = Field(..., description="Nuevo permiso de edición")


class ColaboradorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_colaborador: int
    id_proyecto: int
    id_usuario: int
    nombre: str
    apellido: Optional[str] = None
    email: str
    permiso_edicion: bool
    estado: str
    fecha_invitacion: datetime
    fecha_aceptacion: Optional[datetime] = None


class ProyectoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_proyecto: int
    id_propietario: int
    nombre: str
    descripcion: Optional[str] = None
    estado: str
    fecha_creacion: datetime
    fecha_modificacion: datetime
    es_propietario: bool = False
    rol: str = "Invitado"
    permiso_edicion: bool = True
    propietario_nombre: Optional[str] = None
    propietario_email: Optional[str] = None
    colaboradores: List[ColaboradorResponse] = []
    total_clases: int = 0
    total_relaciones: int = 0
