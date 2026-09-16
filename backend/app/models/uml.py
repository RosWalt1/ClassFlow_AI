from sqlalchemy import BigInteger, String, Boolean, Numeric, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from .base import Base


class ClaseUML(Base):
    __tablename__ = "clase_uml"

    id_clase: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_diagrama: Mapped[int] = mapped_column(BigInteger, ForeignKey("diagrama.id_diagrama"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    estereotipo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    visibilidad: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    es_abstracta: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    posicion_x: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    posicion_y: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    ancho: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=220)
    alto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=150)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    fecha_modificacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    diagrama = relationship("Diagrama", back_populates="clases")
    atributos = relationship("AtributoUML", back_populates="clase", cascade="all, delete-orphan", order_by="AtributoUML.orden")
    metodos = relationship("MetodoUML", back_populates="clase", cascade="all, delete-orphan", order_by="MetodoUML.orden")
    relaciones_origen = relationship("RelacionUML", foreign_keys="RelacionUML.id_clase_origen", back_populates="clase_origen")
    relaciones_destino = relationship("RelacionUML", foreign_keys="RelacionUML.id_clase_destino", back_populates="clase_destino")


class AtributoUML(Base):
    __tablename__ = "atributo_uml"

    id_atributo: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_clase: Mapped[int] = mapped_column(BigInteger, ForeignKey("clase_uml.id_clase"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo_dato: Mapped[str] = mapped_column(String(100), nullable=False)
    visibilidad: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    valor_defecto: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    es_estatico: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    es_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    es_nullable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    clase = relationship("ClaseUML", back_populates="atributos")


class MetodoUML(Base):
    __tablename__ = "metodo_uml"

    id_metodo: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_clase: Mapped[int] = mapped_column(BigInteger, ForeignKey("clase_uml.id_clase"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo_retorno: Mapped[str] = mapped_column(String(100), nullable=False, default="void")
    visibilidad: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    es_estatico: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    es_abstracto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    clase = relationship("ClaseUML", back_populates="metodos")
    parametros = relationship("ParametroUML", back_populates="metodo", cascade="all, delete-orphan", order_by="ParametroUML.orden")


class ParametroUML(Base):
    __tablename__ = "parametro_uml"

    id_parametro: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_metodo: Mapped[int] = mapped_column(BigInteger, ForeignKey("metodo_uml.id_metodo"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo_dato: Mapped[str] = mapped_column(String(100), nullable=False)
    valor_defecto: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    metodo = relationship("MetodoUML", back_populates="parametros")


class RelacionUML(Base):
    __tablename__ = "relacion_uml"

    id_relacion: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_diagrama: Mapped[int] = mapped_column(BigInteger, ForeignKey("diagrama.id_diagrama"), nullable=False)
    id_clase_origen: Mapped[int] = mapped_column(BigInteger, ForeignKey("clase_uml.id_clase"), nullable=False)
    id_clase_destino: Mapped[int] = mapped_column(BigInteger, ForeignKey("clase_uml.id_clase"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    nombre: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    multiplicidad_origen: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    multiplicidad_destino: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rol_origen: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rol_destino: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    navegabilidad_origen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    navegabilidad_destino: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    diagrama = relationship("Diagrama", back_populates="relaciones")
    clase_origen = relationship("ClaseUML", foreign_keys=[id_clase_origen], back_populates="relaciones_origen")
    clase_destino = relationship("ClaseUML", foreign_keys=[id_clase_destino], back_populates="relaciones_destino")
