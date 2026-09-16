from sqlalchemy import BigInteger, String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional, List
from datetime import datetime

from .base import Base


class Diagrama(Base):
    __tablename__ = "diagrama"

    id_diagrama: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_proyecto: Mapped[int] = mapped_column(BigInteger, ForeignKey("proyecto.id_proyecto"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_modificacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    proyecto = relationship("Proyecto", back_populates="diagramas")
    clases = relationship("ClaseUML", back_populates="diagrama", cascade="all, delete-orphan")
    relaciones = relationship("RelacionUML", back_populates="diagrama", cascade="all, delete-orphan")
    sesiones = relationship("SesionColaborativa", back_populates="diagrama")
