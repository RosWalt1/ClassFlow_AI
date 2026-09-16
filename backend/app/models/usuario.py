from sqlalchemy import BigInteger, String, DateTime, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional, List
from datetime import datetime

from .base import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    apellido: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="activo")
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    ultimo_acceso: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    proyectos_propios = relationship("Proyecto", back_populates="propietario", foreign_keys="Proyecto.id_propietario")
    colaboraciones = relationship("ProyectoColaborador", back_populates="usuario")
    sesiones_participadas = relationship("SesionParticipante", back_populates="usuario")
