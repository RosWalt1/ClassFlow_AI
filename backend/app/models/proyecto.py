from sqlalchemy import BigInteger, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional, List
from datetime import datetime

from .base import Base


class Proyecto(Base):
    __tablename__ = "proyecto"

    id_proyecto: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_propietario: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_modificacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    propietario = relationship("Usuario", back_populates="proyectos_propios", foreign_keys=[id_propietario])
    colaboradores = relationship("ProyectoColaborador", back_populates="proyecto")
    diagramas = relationship("Diagrama", back_populates="proyecto")
    sesiones = relationship("SesionColaborativa", back_populates="proyecto")


class ProyectoColaborador(Base):
    __tablename__ = "proyecto_colaborador"

    id_colaborador: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_proyecto: Mapped[int] = mapped_column(BigInteger, ForeignKey("proyecto.id_proyecto"), nullable=False)
    id_usuario: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    permiso_edicion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    fecha_invitacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_aceptacion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    proyecto = relationship("Proyecto", back_populates="colaboradores")
    usuario = relationship("Usuario", back_populates="colaboraciones")
