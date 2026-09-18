from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, select
from fastapi import HTTPException, status

from app.models.proyecto import Proyecto, ProyectoColaborador
from app.models.usuario import Usuario
from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, RelacionUML
from app.schemas.proyecto import (
    ProyectoCreate,
    ProyectoUpdate,
    ProyectoResponse,
    ColaboradorCreate,
    ColaboradorUpdate,
    ColaboradorResponse,
)


# Estados de colaboración que otorgan acceso efectivo a los proyectos según CU02
ESTADOS_COLABORADOR_ACTIVO = ("activo", "aceptado")


class ProyectoService:
    @staticmethod
    def _to_colaborador_response(colab: ProyectoColaborador) -> ColaboradorResponse:
        user = colab.usuario
        return ColaboradorResponse(
            id_colaborador=colab.id_colaborador,
            id_proyecto=colab.id_proyecto,
            id_usuario=colab.id_usuario,
            nombre=user.nombre if user else f"Usuario #{colab.id_usuario}",
            apellido=user.apellido if user else None,
            email=user.email if user else "",
            permiso_edicion=colab.permiso_edicion,
            estado=colab.estado,
            fecha_invitacion=colab.fecha_invitacion,
            fecha_aceptacion=colab.fecha_aceptacion,
        )

    @staticmethod
    def _to_proyecto_response(
        proyecto: Proyecto, current_user_id: int, db: Session
    ) -> ProyectoResponse:
        es_propietario = proyecto.id_propietario == current_user_id
        rol = "Propietario" if es_propietario else "Invitado"

        permiso_edicion = True
        if not es_propietario:
            # Check collaborator permission ONLY for active authorized collaborations
            colab = (
                db.query(ProyectoColaborador)
                .filter(
                    ProyectoColaborador.id_proyecto == proyecto.id_proyecto,
                    ProyectoColaborador.id_usuario == current_user_id,
                    ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
                )
                .order_by(ProyectoColaborador.id_colaborador.desc())
                .first()
            )
            permiso_edicion = colab.permiso_edicion if colab else False

        # Load active collaborators (only states that grant active collaboration)
        colabs = (
            db.query(ProyectoColaborador)
            .options(joinedload(ProyectoColaborador.usuario))
            .filter(
                ProyectoColaborador.id_proyecto == proyecto.id_proyecto,
                ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
            )
            .all()
        )
        colaboradores_resp = [ProyectoService._to_colaborador_response(c) for c in colabs]

        # Calculate classes and relations count from diagrams
        diagram_ids = (
            db.query(Diagrama.id_diagrama)
            .filter(Diagrama.id_proyecto == proyecto.id_proyecto)
            .all()
        )
        diag_ids = [d[0] for d in diagram_ids]

        total_clases = 0
        total_relaciones = 0
        if diag_ids:
            total_clases = (
                db.query(func.count(ClaseUML.id_clase))
                .filter(ClaseUML.id_diagrama.in_(diag_ids))
                .scalar()
                or 0
            )
            total_relaciones = (
                db.query(func.count(RelacionUML.id_relacion))
                .filter(RelacionUML.id_diagrama.in_(diag_ids))
                .scalar()
                or 0
            )

        propietario_nombre = proyecto.propietario.nombre if proyecto.propietario else None
        propietario_email = proyecto.propietario.email if proyecto.propietario else None

        return ProyectoResponse(
            id_proyecto=proyecto.id_proyecto,
            id_propietario=proyecto.id_propietario,
            nombre=proyecto.nombre,
            descripcion=proyecto.descripcion,
            estado=proyecto.estado,
            fecha_creacion=proyecto.fecha_creacion,
            fecha_modificacion=proyecto.fecha_modificacion,
            es_propietario=es_propietario,
            rol=rol,
            permiso_edicion=permiso_edicion,
            propietario_nombre=propietario_nombre,
            propietario_email=propietario_email,
            colaboradores=colaboradores_resp,
            total_clases=total_clases,
            total_relaciones=total_relaciones,
        )

    @classmethod
    def create_proyecto(
        cls, db: Session, current_user: Usuario, data: ProyectoCreate
    ) -> ProyectoResponse:
        """
        Crea un nuevo proyecto en PostgreSQL asignando obligatoriamente
        como propietario al usuario autenticado.
        """
        now = datetime.now()
        proyecto = Proyecto(
            id_propietario=current_user.id_usuario,
            nombre=data.nombre.strip(),
            descripcion=data.descripcion.strip() if data.descripcion else None,
            estado="activo",
            fecha_creacion=now,
            fecha_modificacion=now,
        )
        db.add(proyecto)
        db.commit()
        db.refresh(proyecto)
        return cls._to_proyecto_response(proyecto, current_user.id_usuario, db)

    @classmethod
    def get_proyectos_for_user(
        cls, db: Session, current_user_id: int, tipo: str = "all"
    ) -> List[ProyectoResponse]:
        """
        Lista proyectos accesibles para el usuario autenticado:
        - Propios (donde es propietario)
        - Compartidos (donde es colaborador con estado aceptado/activo)
        Soporta filtro por tipo: 'all', 'owner', 'guest'.
        """
        query = db.query(Proyecto).options(joinedload(Proyecto.propietario))

        if tipo == "owner":
            query = query.filter(
                Proyecto.id_propietario == current_user_id,
                Proyecto.estado != "eliminado",
            )
        elif tipo == "guest":
            colab_select = (
                select(ProyectoColaborador.id_proyecto)
                .filter(
                    ProyectoColaborador.id_usuario == current_user_id,
                    ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
                )
            )
            query = query.filter(
                Proyecto.id_proyecto.in_(colab_select),
                Proyecto.id_propietario != current_user_id,
                Proyecto.estado != "eliminado",
            )
        else:
            # 'all': proyectos propios o donde es colaborador
            colab_select = (
                select(ProyectoColaborador.id_proyecto)
                .filter(
                    ProyectoColaborador.id_usuario == current_user_id,
                    ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
                )
            )
            query = query.filter(
                or_(
                    Proyecto.id_propietario == current_user_id,
                    Proyecto.id_proyecto.in_(colab_select),
                ),
                Proyecto.estado != "eliminado",
            )

        proyectos = query.order_by(Proyecto.fecha_modificacion.desc()).all()
        return [cls._to_proyecto_response(p, current_user_id, db) for p in proyectos]

    @classmethod
    def get_proyecto_by_id(
        cls, db: Session, proyecto_id: int, current_user_id: int
    ) -> ProyectoResponse:
        """
        Consulta un proyecto por ID. Valida que el usuario sea el propietario
        o un colaborador activo en el proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .options(joinedload(Proyecto.propietario))
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        # Autorización
        es_propietario = proyecto.id_propietario == current_user_id
        if not es_propietario:
            es_colaborador = (
                db.query(ProyectoColaborador)
                .filter(
                    ProyectoColaborador.id_proyecto == proyecto_id,
                    ProyectoColaborador.id_usuario == current_user_id,
                    ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
                )
                .first()
            )
            if not es_colaborador:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permiso para acceder a este proyecto.",
                )

        return cls._to_proyecto_response(proyecto, current_user_id, db)

    @classmethod
    def update_proyecto(
        cls, db: Session, proyecto_id: int, current_user_id: int, data: ProyectoUpdate
    ) -> ProyectoResponse:
        """
        Modifica nombre, descripción o estado de un proyecto.
        SOLO permitido al propietario del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede modificar el proyecto.",
            )

        if data.nombre is not None:
            proyecto.nombre = data.nombre.strip()
        if data.descripcion is not None:
            proyecto.descripcion = data.descripcion.strip()
        if data.estado is not None:
            proyecto.estado = data.estado

        proyecto.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(proyecto)
        return cls._to_proyecto_response(proyecto, current_user_id, db)

    @classmethod
    def archive_proyecto(
        cls, db: Session, proyecto_id: int, current_user_id: int
    ) -> ProyectoResponse:
        """
        Archiva un proyecto (cambia estado a 'archivado').
        SOLO permitido al propietario del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede archivar el proyecto.",
            )

        proyecto.estado = "archivado"
        proyecto.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(proyecto)
        return cls._to_proyecto_response(proyecto, current_user_id, db)

    @classmethod
    def delete_proyecto(
        cls, db: Session, proyecto_id: int, current_user_id: int
    ) -> dict:
        """
        Eliminación suave o física controlada según el modelo.
        SOLO permitido al propietario del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede eliminar el proyecto.",
            )

        # Soft delete marcando como archivado o eliminado para preservar integridad referencial
        proyecto.estado = "eliminado"
        proyecto.fecha_modificacion = datetime.now()
        db.commit()
        return {"message": "Proyecto eliminado correctamente.", "id_proyecto": proyecto_id}

    # ==========================================
    # GESTIÓN DE COLABORADORES (CU02)
    # ==========================================

    @classmethod
    def add_colaborador(
        cls,
        db: Session,
        proyecto_id: int,
        current_user_id: int,
        data: ColaboradorCreate,
    ) -> ColaboradorResponse:
        """
        Invita/agrega un colaborador al proyecto mediante su correo.
        SOLO permitido al propietario del proyecto.
        Reglas:
        - El usuario invitado debe existir en la tabla `usuario`.
        - No se puede agregar al propietario como colaborador.
        - No se puede duplicar un colaborador activo en el mismo proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede administrar colaboradores.",
            )

        # Buscar usuario por correo
        normalized_email = data.email.strip().lower()
        target_user = (
            db.query(Usuario)
            .filter(func.lower(Usuario.email) == normalized_email)
            .first()
        )
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se encontró ningún usuario registrado con el correo '{data.email}'.",
            )

        # Verificar que no sea el propietario
        if target_user.id_usuario == proyecto.id_propietario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El propietario del proyecto no puede ser agregado como colaborador.",
            )

        # Verificar si ya existe en este proyecto
        existing_colab = (
            db.query(ProyectoColaborador)
            .filter(
                ProyectoColaborador.id_proyecto == proyecto_id,
                ProyectoColaborador.id_usuario == target_user.id_usuario,
            )
            .first()
        )

        now = datetime.now()
        if existing_colab:
            if existing_colab.estado in ESTADOS_COLABORADOR_ACTIVO:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El usuario '{target_user.nombre}' ya es colaborador de este proyecto.",
                )
            # Si estaba revocado, rechazado o inactivo, reactivar
            existing_colab.estado = "aceptado"
            existing_colab.permiso_edicion = data.permiso_edicion
            existing_colab.fecha_invitacion = now
            existing_colab.fecha_aceptacion = now
            db.commit()
            db.refresh(existing_colab)
            return cls._to_colaborador_response(existing_colab)

        nuevo_colab = ProyectoColaborador(
            id_proyecto=proyecto_id,
            id_usuario=target_user.id_usuario,
            permiso_edicion=data.permiso_edicion,
            estado="aceptado",
            fecha_invitacion=now,
            fecha_aceptacion=now,
        )
        db.add(nuevo_colab)
        db.commit()
        db.refresh(nuevo_colab)
        return cls._to_colaborador_response(nuevo_colab)

    @classmethod
    def list_colaboradores(
        cls, db: Session, proyecto_id: int, current_user_id: int
    ) -> List[ColaboradorResponse]:
        """
        Lista los colaboradores de un proyecto.
        Permitido al propietario y a colaboradores activos del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        # Autorización de lectura
        es_propietario = proyecto.id_propietario == current_user_id
        if not es_propietario:
            es_colaborador = (
                db.query(ProyectoColaborador)
                .filter(
                    ProyectoColaborador.id_proyecto == proyecto_id,
                    ProyectoColaborador.id_usuario == current_user_id,
                    ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
                )
                .first()
            )
            if not es_colaborador:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permiso para ver los colaboradores de este proyecto.",
                )

        colaboradores = (
            db.query(ProyectoColaborador)
            .options(joinedload(ProyectoColaborador.usuario))
            .filter(
                ProyectoColaborador.id_proyecto == proyecto_id,
                ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
            )
            .all()
        )
        return [cls._to_colaborador_response(c) for c in colaboradores]

    @classmethod
    def update_colaborador_permiso(
        cls,
        db: Session,
        proyecto_id: int,
        colaborador_id: int,
        current_user_id: int,
        data: ColaboradorUpdate,
    ) -> ColaboradorResponse:
        """
        Modifica el permiso de edición de un colaborador.
        SOLO permitido al propietario del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede modificar permisos de colaboradores.",
            )

        colab = (
            db.query(ProyectoColaborador)
            .options(joinedload(ProyectoColaborador.usuario))
            .filter(
                ProyectoColaborador.id_colaborador == colaborador_id,
                ProyectoColaborador.id_proyecto == proyecto_id,
            )
            .first()
        )
        if not colab or colab.estado not in ESTADOS_COLABORADOR_ACTIVO:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Colaborador no encontrado en este proyecto.",
            )

        colab.permiso_edicion = data.permiso_edicion
        db.commit()
        db.refresh(colab)

        # Notificar en tiempo real a salas de diagramas del proyecto
        from app.models.diagrama import Diagrama
        from app.services.diagrama_service import DiagramaService
        diagramas_proj = db.query(Diagrama).filter(Diagrama.id_proyecto == proyecto_id).all()
        for diag in diagramas_proj:
            DiagramaService._notify_diagram_changed(diag.id_diagrama, current_user_id)

        return cls._to_colaborador_response(colab)

    @classmethod
    def remove_colaborador(
        cls, db: Session, proyecto_id: int, colaborador_id: int, current_user_id: int
    ) -> dict:
        """
        Revoca/elimina un colaborador del proyecto.
        SOLO permitido al propietario del proyecto.
        """
        proyecto = (
            db.query(Proyecto)
            .filter(Proyecto.id_proyecto == proyecto_id)
            .first()
        )
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        if proyecto.id_propietario != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede revocar colaboradores.",
            )

        colab = (
            db.query(ProyectoColaborador)
            .filter(
                ProyectoColaborador.id_colaborador == colaborador_id,
                ProyectoColaborador.id_proyecto == proyecto_id,
            )
            .first()
        )
        if not colab or colab.estado not in ESTADOS_COLABORADOR_ACTIVO:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Colaborador no encontrado en este proyecto.",
            )

        colab.estado = "revocado"
        db.commit()
        return {
            "message": "Colaborador revocado correctamente.",
            "id_colaborador": colaborador_id,
            "id_proyecto": proyecto_id,
        }
