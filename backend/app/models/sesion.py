from sqlalchemy import BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional, List
from datetime import datetime

from .base import Base


class SesionColaborativa(Base):
    __tablename__ = "sesion_colaborativa"

    id_sesion: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_proyecto: Mapped[int] = mapped_column(BigInteger, ForeignKey("proyecto.id_proyecto"), nullable=False)
    id_diagrama: Mapped[int] = mapped_column(BigInteger, ForeignKey("diagrama.id_diagrama"), nullable=False)
    id_anfitrion: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    codigo_sesion: Mapped[str] = mapped_column(String(50), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="activa")
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_fin: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    proyecto = relationship("Proyecto", back_populates="sesiones")
    diagrama = relationship("Diagrama", back_populates="sesiones")
    anfitrion = relationship("Usuario", foreign_keys=[id_anfitrion])
    participantes = relationship("SesionParticipante", back_populates="sesion", cascade="all, delete-orphan")


class SesionParticipante(Base):
    __tablename__ = "sesion_participante"

    id_participante: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_sesion: Mapped[int] = mapped_column(BigInteger, ForeignKey("sesion_colaborativa.id_sesion"), nullable=False)
    id_usuario: Mapped[int] = mapped_column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    fecha_ingreso: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_salida: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="conectado")

    # Relationships
    sesion = relationship("SesionColaborativa", back_populates="participantes")
    usuario = relationship("Usuario", back_populates="sesiones_participadas")
