import secrets
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.sesion import SesionColaborativa, SesionParticipante
from app.models.usuario import Usuario
from app.models.diagrama import Diagrama
from app.services.diagrama_service import DiagramaService
from app.core.ws_manager import ws_manager


class ColaboracionService:
    @staticmethod
    def _generate_unique_codigo_sesion(db: Session) -> str:
        """
        Genera un código de sesión criptográficamente seguro y verifica su unicidad.
        Formato: 'CF-' + 16 caracteres alfanuméricos seguros (ej. 'CF-Ab9xK2mP7qR4tY1w').
        Longitud total <= 24 caracteres (la columna en BD admite hasta 50).
        """
        while True:
            candidate = f"CF-{secrets.token_urlsafe(12).replace('-', '').replace('_', '')[:16].upper()}"
            exists = (
                db.query(SesionColaborativa)
                .filter(SesionColaborativa.codigo_sesion == candidate)
                .first()
            )
            if not exists:
                return candidate

    @classmethod
    def get_or_create_sesion_activa(
        cls, db: Session, proyecto_id: int, diagrama_id: int, anfitrion_id: int
    ) -> SesionColaborativa:
        """
        Obtiene la sesión colaborativa actualmente activa para el proyecto y diagrama.
        Si no existe ninguna sesión con estado 'activa', crea una nueva con código seguro.
        """
        sesion = (
            db.query(SesionColaborativa)
            .filter(
                SesionColaborativa.id_proyecto == proyecto_id,
                SesionColaborativa.id_diagrama == diagrama_id,
                SesionColaborativa.estado == "activa",
            )
            .order_by(SesionColaborativa.id_sesion.desc())
            .first()
        )

        if sesion:
            return sesion

        codigo = cls._generate_unique_codigo_sesion(db)
        now = datetime.now()
        nueva_sesion = SesionColaborativa(
            id_proyecto=proyecto_id,
            id_diagrama=diagrama_id,
            id_anfitrion=anfitrion_id,
            codigo_sesion=codigo,
            estado="activa",
            fecha_inicio=now,
        )
        db.add(nueva_sesion)
        db.commit()
        db.refresh(nueva_sesion)
        return nueva_sesion

    @classmethod
    def registrar_ingreso(
        cls, db: Session, sesion_id: int, user_id: int
    ) -> SesionParticipante:
        """
        Registra o reactiva el participante en la sesión colaborativa.
        Garantiza que no se creen registros duplicados con estado 'conectado' para el mismo usuario.
        """
        # 1. Buscar si ya existe conectado
        part_activo = (
            db.query(SesionParticipante)
            .filter(
                SesionParticipante.id_sesion == sesion_id,
                SesionParticipante.id_usuario == user_id,
                SesionParticipante.estado == "conectado",
            )
            .first()
        )
        if part_activo:
            return part_activo

        # 2. Buscar si existe un registro previo desconectado en esta misma sesión para reactivarlo
        part_previo = (
            db.query(SesionParticipante)
            .filter(
                SesionParticipante.id_sesion == sesion_id,
                SesionParticipante.id_usuario == user_id,
            )
            .order_by(SesionParticipante.id_participante.desc())
            .first()
        )

        now = datetime.now()
        if part_previo:
            part_previo.estado = "conectado"
            part_previo.fecha_ingreso = now
            part_previo.fecha_salida = None
            db.commit()
            db.refresh(part_previo)
            return part_previo

        # 3. Crear nuevo registro de participante
        nuevo_part = SesionParticipante(
            id_sesion=sesion_id,
            id_usuario=user_id,
            fecha_ingreso=now,
            estado="conectado",
        )
        db.add(nuevo_part)
        db.commit()
        db.refresh(nuevo_part)
        return nuevo_part

    @classmethod
    def registrar_salida(
        cls, db: Session, sesion_id: int, user_id: int, diagrama_id: int
    ) -> Optional[SesionParticipante]:
        """
        Registra la desconexión del participante en PostgreSQL.
        Solo se ejecuta cuando el usuario ha cerrado su último socket activo en el diagrama.
        Si ya no queda ningún usuario conectado a la sesión, finaliza la sesión colaborativa.
        """
        part = (
            db.query(SesionParticipante)
            .filter(
                SesionParticipante.id_sesion == sesion_id,
                SesionParticipante.id_usuario == user_id,
                SesionParticipante.estado == "conectado",
            )
            .first()
        )
        if not part:
            return None

        now = datetime.now()
        part.estado = "desconectado"
        part.fecha_salida = now
        db.commit()
        db.refresh(part)

        # Si ya no quedan participantes conectados en la base de datos ni en memoria ws_manager
        participantes_conectados = (
            db.query(SesionParticipante)
            .filter(
                SesionParticipante.id_sesion == sesion_id,
                SesionParticipante.estado == "conectado",
            )
            .count()
        )

        if participantes_conectados == 0 and not ws_manager.get_active_participants(diagrama_id):
            sesion = db.query(SesionColaborativa).filter(SesionColaborativa.id_sesion == sesion_id).first()
            if sesion and sesion.estado == "activa":
                sesion.estado = "finalizada"
                sesion.fecha_fin = now
                db.commit()

        return part

    @classmethod
    def get_active_session_info(
        cls, db: Session, diagrama_id: int, user_id: int
    ) -> Dict:
        """
        Consulta la información de la sesión colaborativa activa para un diagrama.
        Valida que el usuario tenga acceso al diagrama.
        """
        diagrama, es_propietario, permiso_edicion = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id
        )

        sesion = (
            db.query(SesionColaborativa)
            .filter(
                SesionColaborativa.id_diagrama == diagrama_id,
                SesionColaborativa.estado == "activa",
            )
            .order_by(SesionColaborativa.id_sesion.desc())
            .first()
        )

        participantes_memoria = ws_manager.get_active_participants(diagrama_id)

        return {
            "id_diagrama": diagrama_id,
            "id_proyecto": diagrama.id_proyecto,
            "id_sesion": sesion.id_sesion if sesion else None,
            "codigo_sesion": sesion.codigo_sesion if sesion else None,
            "estado_sesion": sesion.estado if sesion else "sin_sesion",
            "es_propietario": es_propietario,
            "permiso_edicion": permiso_edicion,
            "participantes_online": participantes_memoria,
        }
