from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.proyecto import Proyecto, ProyectoColaborador
from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.services.proyecto_service import ESTADOS_COLABORADOR_ACTIVO
from app.schemas.uml import (
    TIPOS_RELACION_VALIDOS,
    ClaseUMLCreate,
    ClaseUMLUpdate,
    ClaseUMLPosicionUpdate,
    ClaseUMLResponse,
    AtributoUMLCreate,
    AtributoUMLUpdate,
    AtributoUMLResponse,
    MetodoUMLCreate,
    MetodoUMLUpdate,
    MetodoUMLResponse,
    ParametroUMLCreate,
    ParametroUMLUpdate,
    ParametroUMLResponse,
    RelacionUMLCreate,
    RelacionUMLUpdate,
    RelacionUMLResponse,
    DiagramaUpdate,
    DiagramaResponse,
)


class DiagramaService:
    # =========================================================================
    # AUTHORIZATION HELPERS
    # =========================================================================
    @staticmethod
    def get_proyecto_permiso(db: Session, proyecto_id: int, user_id: int) -> Tuple[Proyecto, bool, bool]:
        """
        Verifica el acceso del usuario al proyecto.
        Retorna (proyecto, es_propietario, permiso_edicion).
        Lanza 404 si el proyecto no existe o está eliminado.
        Lanza 403 si el usuario no tiene acceso según las reglas unificadas de CU02.
        """
        proyecto = db.query(Proyecto).filter(Proyecto.id_proyecto == proyecto_id).first()
        if not proyecto or proyecto.estado == "eliminado":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado.",
            )

        es_propietario = proyecto.id_propietario == user_id
        if es_propietario:
            return proyecto, True, True

        # Colaborador activo / aceptado
        colab = (
            db.query(ProyectoColaborador)
            .filter(
                ProyectoColaborador.id_proyecto == proyecto_id,
                ProyectoColaborador.id_usuario == user_id,
                ProyectoColaborador.estado.in_(ESTADOS_COLABORADOR_ACTIVO),
            )
            .first()
        )
        if not colab:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para acceder a este proyecto.",
            )

        return proyecto, False, bool(colab.permiso_edicion)

    @classmethod
    def get_diagrama_permiso(
        cls, db: Session, diagrama_id: int, user_id: int, require_edit: bool = False
    ) -> Tuple[Diagrama, bool, bool]:
        """
        Verifica el acceso del usuario al diagrama a través de su proyecto padre.
        Lanza 404 si el diagrama no existe.
        Lanza 403 si el usuario no tiene acceso o si require_edit=True y permiso_edicion=False.
        """
        diagrama = (
            db.query(Diagrama)
            .filter(Diagrama.id_diagrama == diagrama_id)
            .first()
        )
        if not diagrama:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagrama no encontrado.",
            )

        _, es_propietario, permiso_edicion = cls.get_proyecto_permiso(
            db, diagrama.id_proyecto, user_id
        )

        if require_edit and not permiso_edicion:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso de edición para modificar este diagrama UML.",
            )

        return diagrama, es_propietario, permiso_edicion

    # =========================================================================
    # DIAGRAMA CORE
    # =========================================================================
    @classmethod
    def get_or_create_diagrama(
        cls, db: Session, proyecto_id: int, user_id: int
    ) -> DiagramaResponse:
        """
        Obtiene el diagrama principal del proyecto. Si no existe ninguno,
        crea de forma controlada el diagrama principal por defecto.
        Retorna la estructura completa con clases, relaciones y permisos.
        """
        proyecto, es_propietario, permiso_edicion = cls.get_proyecto_permiso(
            db, proyecto_id, user_id
        )

        diagrama = (
            db.query(Diagrama)
            .options(
                joinedload(Diagrama.clases)
                .joinedload(ClaseUML.atributos),
                joinedload(Diagrama.clases)
                .joinedload(ClaseUML.metodos)
                .joinedload(MetodoUML.parametros),
                joinedload(Diagrama.relaciones),
            )
            .filter(Diagrama.id_proyecto == proyecto_id)
            .order_by(Diagrama.id_diagrama.asc())
            .first()
        )

        if not diagrama:
            now = datetime.now()
            diagrama = Diagrama(
                id_proyecto=proyecto_id,
                nombre=f"Diagrama Principal",
                descripcion=f"Diagrama de clases principal de {proyecto.nombre}",
                version=1,
                fecha_creacion=now,
                fecha_modificacion=now,
            )
            db.add(diagrama)
            db.commit()
            db.refresh(diagrama)

        return cls._build_diagrama_response(diagrama, es_propietario, permiso_edicion)

    @classmethod
    def update_diagrama(
        cls, db: Session, diagrama_id: int, user_id: int, data: DiagramaUpdate
    ) -> DiagramaResponse:
        diagrama, es_propietario, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )

        if data.nombre is not None:
            diagrama.nombre = data.nombre.strip()
        if data.descripcion is not None:
            diagrama.descripcion = data.descripcion.strip()

        diagrama.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(diagrama)
        return cls._build_diagrama_response(diagrama, es_propietario, True)

    # =========================================================================
    # CLASES UML
    # =========================================================================
    @classmethod
    def create_clase(
        cls, db: Session, diagrama_id: int, user_id: int, data: ClaseUMLCreate
    ) -> ClaseUMLResponse:
        diagrama, _, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )

        nombre_limpio = data.nombre.strip()
        if not nombre_limpio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de la clase es obligatorio.",
            )

        # Evitar clases duplicadas dentro del mismo diagrama
        existente = (
            db.query(ClaseUML)
            .filter(
                ClaseUML.id_diagrama == diagrama_id,
                ClaseUML.nombre.ilike(nombre_limpio),
            )
            .first()
        )
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una clase llamada '{nombre_limpio}' en este diagrama.",
            )

        now = datetime.now()
        nueva_clase = ClaseUML(
            id_diagrama=diagrama_id,
            nombre=nombre_limpio,
            estereotipo=data.estereotipo.strip() if data.estereotipo else None,
            visibilidad=data.visibilidad or "public",
            es_abstracta=data.es_abstracta,
            posicion_x=Decimal(str(data.posicion_x)),
            posicion_y=Decimal(str(data.posicion_y)),
            ancho=Decimal(str(data.ancho)),
            alto=Decimal(str(data.alto)),
            fecha_creacion=now,
            fecha_modificacion=now,
        )
        db.add(nueva_clase)
        diagrama.fecha_modificacion = now
        db.commit()
        db.refresh(nueva_clase)

        return cls._to_clase_response(nueva_clase)

    @classmethod
    def get_clase(cls, db: Session, diagrama_id: int, clase_id: int, user_id: int) -> ClaseUMLResponse:
        cls.get_diagrama_permiso(db, diagrama_id, user_id, require_edit=False)
        clase = (
            db.query(ClaseUML)
            .options(
                joinedload(ClaseUML.atributos),
                joinedload(ClaseUML.metodos).joinedload(MetodoUML.parametros),
            )
            .filter(ClaseUML.id_clase == clase_id, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada en este diagrama.",
            )
        return cls._to_clase_response(clase)

    @classmethod
    def update_clase(
        cls, db: Session, diagrama_id: int, clase_id: int, user_id: int, data: ClaseUMLUpdate
    ) -> ClaseUMLResponse:
        diagrama, _, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        clase = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_clase == clase_id, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada en este diagrama.",
            )

        if data.nombre is not None:
            nombre_limpio = data.nombre.strip()
            if not nombre_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre de la clase no puede estar vacío.",
                )
            if nombre_limpio.lower() != clase.nombre.lower():
                dup = (
                    db.query(ClaseUML)
                    .filter(
                        ClaseUML.id_diagrama == diagrama_id,
                        ClaseUML.nombre.ilike(nombre_limpio),
                        ClaseUML.id_clase != clase_id,
                    )
                    .first()
                )
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ya existe otra clase llamada '{nombre_limpio}' en este diagrama.",
                    )
            clase.nombre = nombre_limpio

        if data.estereotipo is not None:
            clase.estereotipo = data.estereotipo.strip() if data.estereotipo.strip() else None
        if data.visibilidad is not None:
            clase.visibilidad = data.visibilidad
        if data.es_abstracta is not None:
            clase.es_abstracta = data.es_abstracta
        if data.ancho is not None:
            clase.ancho = Decimal(str(data.ancho))
        if data.alto is not None:
            clase.alto = Decimal(str(data.alto))

        now = datetime.now()
        clase.fecha_modificacion = now
        diagrama.fecha_modificacion = now
        db.commit()
        db.refresh(clase)
        return cls._to_clase_response(clase)

    @classmethod
    def update_clase_posicion(
        cls, db: Session, diagrama_id: int, clase_id: int, user_id: int, data: ClaseUMLPosicionUpdate
    ) -> ClaseUMLResponse:
        diagrama, _, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        clase = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_clase == clase_id, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada en este diagrama.",
            )

        clase.posicion_x = Decimal(str(data.posicion_x))
        clase.posicion_y = Decimal(str(data.posicion_y))
        now = datetime.now()
        clase.fecha_modificacion = now
        diagrama.fecha_modificacion = now
        db.commit()
        db.refresh(clase)
        return cls._to_clase_response(clase)

    @classmethod
    def delete_clase(
        cls, db: Session, diagrama_id: int, clase_id: int, user_id: int
    ) -> dict:
        """
        Elimina una clase UML del diagrama garantizando integridad referencial:
        - Elimina de forma explícita las relaciones donde la clase sea origen o destino.
        - Elimina la clase (cascade delete-orphan limpia atributos, métodos y parámetros).
        """
        diagrama, _, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        clase = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_clase == clase_id, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada en este diagrama.",
            )

        # 1. Eliminar relaciones asociadas de forma segura
        relaciones_asociadas = (
            db.query(RelacionUML)
            .filter(
                RelacionUML.id_diagrama == diagrama_id,
                (RelacionUML.id_clase_origen == clase_id) | (RelacionUML.id_clase_destino == clase_id),
            )
            .all()
        )
        for rel in relaciones_asociadas:
            db.delete(rel)

        # 2. Eliminar la clase
        db.delete(clase)
        diagrama.fecha_modificacion = datetime.now()
        db.commit()

        return {
            "message": "Clase UML eliminada correctamente.",
            "id_clase": clase_id,
            "id_diagrama": diagrama_id,
        }

    # =========================================================================
    # ATRIBUTOS UML
    # =========================================================================
    @classmethod
    def create_atributo(
        cls, db: Session, clase_id: int, user_id: int, data: AtributoUMLCreate
    ) -> AtributoUMLResponse:
        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == clase_id).first()
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada.",
            )

        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        nombre_limpio = data.nombre.strip()
        tipo_limpio = data.tipo_dato.strip()
        if not nombre_limpio or not tipo_limpio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nombre y tipo de dato del atributo son obligatorios.",
            )

        nuevo_attr = AtributoUML(
            id_clase=clase_id,
            nombre=nombre_limpio,
            tipo_dato=tipo_limpio,
            visibilidad=data.visibilidad or "private",
            valor_defecto=data.valor_defecto.strip() if data.valor_defecto else None,
            es_estatico=data.es_estatico,
            es_final=data.es_final,
            es_nullable=data.es_nullable,
            orden=data.orden,
        )
        db.add(nuevo_attr)
        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(nuevo_attr)
        return AtributoUMLResponse.model_validate(nuevo_attr)

    @classmethod
    def update_atributo(
        cls, db: Session, atributo_id: int, user_id: int, data: AtributoUMLUpdate
    ) -> AtributoUMLResponse:
        attr = db.query(AtributoUML).filter(AtributoUML.id_atributo == atributo_id).first()
        if not attr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Atributo UML no encontrado.",
            )

        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == attr.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        if data.nombre is not None:
            nombre_limpio = data.nombre.strip()
            if not nombre_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre del atributo no puede estar vacío.",
                )
            attr.nombre = nombre_limpio

        if data.tipo_dato is not None:
            tipo_limpio = data.tipo_dato.strip()
            if not tipo_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El tipo de dato no puede estar vacío.",
                )
            attr.tipo_dato = tipo_limpio

        if data.visibilidad is not None:
            attr.visibilidad = data.visibilidad
        if data.valor_defecto is not None:
            attr.valor_defecto = data.valor_defecto.strip() if data.valor_defecto.strip() else None
        if data.es_estatico is not None:
            attr.es_estatico = data.es_estatico
        if data.es_final is not None:
            attr.es_final = data.es_final
        if data.es_nullable is not None:
            attr.es_nullable = data.es_nullable
        if data.orden is not None:
            attr.orden = data.orden

        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(attr)
        return AtributoUMLResponse.model_validate(attr)

    @classmethod
    def delete_atributo(cls, db: Session, atributo_id: int, user_id: int) -> dict:
        attr = db.query(AtributoUML).filter(AtributoUML.id_atributo == atributo_id).first()
        if not attr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Atributo UML no encontrado.",
            )

        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == attr.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        db.delete(attr)
        clase.fecha_modificacion = datetime.now()
        db.commit()

        return {
            "message": "Atributo UML eliminado correctamente.",
            "id_atributo": atributo_id,
            "id_clase": clase.id_clase,
        }

    # =========================================================================
    # MÉTODOS Y PARÁMETROS UML
    # =========================================================================
    @classmethod
    def create_metodo(
        cls, db: Session, clase_id: int, user_id: int, data: MetodoUMLCreate
    ) -> MetodoUMLResponse:
        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == clase_id).first()
        if not clase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clase UML no encontrada.",
            )

        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        nombre_limpio = data.nombre.strip()
        if not nombre_limpio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre del método es obligatorio.",
            )

        nuevo_metodo = MetodoUML(
            id_clase=clase_id,
            nombre=nombre_limpio,
            tipo_retorno=data.tipo_retorno.strip() or "void",
            visibilidad=data.visibilidad or "public",
            es_estatico=data.es_estatico,
            es_abstracto=data.es_abstracto,
            orden=data.orden,
        )
        db.add(nuevo_metodo)
        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(nuevo_metodo)
        return MetodoUMLResponse.model_validate(nuevo_metodo)

    @classmethod
    def update_metodo(
        cls, db: Session, metodo_id: int, user_id: int, data: MetodoUMLUpdate
    ) -> MetodoUMLResponse:
        metodo = db.query(MetodoUML).filter(MetodoUML.id_metodo == metodo_id).first()
        if not metodo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Método UML no encontrado.",
            )

        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == metodo.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        if data.nombre is not None:
            nombre_limpio = data.nombre.strip()
            if not nombre_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre del método no puede estar vacío.",
                )
            metodo.nombre = nombre_limpio

        if data.tipo_retorno is not None:
            metodo.tipo_retorno = data.tipo_retorno.strip() or "void"
        if data.visibilidad is not None:
            metodo.visibilidad = data.visibilidad
        if data.es_estatico is not None:
            metodo.es_estatico = data.es_estatico
        if data.es_abstracto is not None:
            metodo.es_abstracto = data.es_abstracto
        if data.orden is not None:
            metodo.orden = data.orden

        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(metodo)
        return MetodoUMLResponse.model_validate(metodo)

    @classmethod
    def delete_metodo(cls, db: Session, metodo_id: int, user_id: int) -> dict:
        metodo = db.query(MetodoUML).filter(MetodoUML.id_metodo == metodo_id).first()
        if not metodo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Método UML no encontrado.",
            )

        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == metodo.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        db.delete(metodo)
        clase.fecha_modificacion = datetime.now()
        db.commit()

        return {
            "message": "Método UML eliminado correctamente.",
            "id_metodo": metodo_id,
            "id_clase": clase.id_clase,
        }

    @classmethod
    def create_parametro(
        cls, db: Session, metodo_id: int, user_id: int, data: ParametroUMLCreate
    ) -> ParametroUMLResponse:
        metodo = db.query(MetodoUML).filter(MetodoUML.id_metodo == metodo_id).first()
        if not metodo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Método UML no encontrado.",
            )

        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == metodo.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        nombre_limpio = data.nombre.strip()
        tipo_limpio = data.tipo_dato.strip()
        if not nombre_limpio or not tipo_limpio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nombre y tipo de dato del parámetro son obligatorios.",
            )

        nuevo_param = ParametroUML(
            id_metodo=metodo_id,
            nombre=nombre_limpio,
            tipo_dato=tipo_limpio,
            valor_defecto=data.valor_defecto.strip() if data.valor_defecto else None,
            orden=data.orden,
        )
        db.add(nuevo_param)
        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(nuevo_param)
        return ParametroUMLResponse.model_validate(nuevo_param)

    @classmethod
    def update_parametro(
        cls, db: Session, parametro_id: int, user_id: int, data: ParametroUMLUpdate
    ) -> ParametroUMLResponse:
        param = db.query(ParametroUML).filter(ParametroUML.id_parametro == parametro_id).first()
        if not param:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parámetro UML no encontrado.",
            )

        metodo = db.query(MetodoUML).filter(MetodoUML.id_metodo == param.id_metodo).first()
        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == metodo.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        if data.nombre is not None:
            nombre_limpio = data.nombre.strip()
            if not nombre_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre del parámetro no puede estar vacío.",
                )
            param.nombre = nombre_limpio

        if data.tipo_dato is not None:
            tipo_limpio = data.tipo_dato.strip()
            if not tipo_limpio:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El tipo de dato del parámetro no puede estar vacío.",
                )
            param.tipo_dato = tipo_limpio

        if data.valor_defecto is not None:
            param.valor_defecto = data.valor_defecto.strip() if data.valor_defecto.strip() else None
        if data.orden is not None:
            param.orden = data.orden

        clase.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(param)
        return ParametroUMLResponse.model_validate(param)

    @classmethod
    def delete_parametro(cls, db: Session, parametro_id: int, user_id: int) -> dict:
        param = db.query(ParametroUML).filter(ParametroUML.id_parametro == parametro_id).first()
        if not param:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parámetro UML no encontrado.",
            )

        metodo = db.query(MetodoUML).filter(MetodoUML.id_metodo == param.id_metodo).first()
        clase = db.query(ClaseUML).filter(ClaseUML.id_clase == metodo.id_clase).first()
        cls.get_diagrama_permiso(db, clase.id_diagrama, user_id, require_edit=True)

        db.delete(param)
        clase.fecha_modificacion = datetime.now()
        db.commit()

        return {
            "message": "Parámetro UML eliminado correctamente.",
            "id_parametro": parametro_id,
            "id_metodo": metodo.id_metodo,
        }

    # =========================================================================
    # RELACIONES UML
    # =========================================================================
    @classmethod
    def create_relacion(
        cls, db: Session, diagrama_id: int, user_id: int, data: RelacionUMLCreate
    ) -> RelacionUMLResponse:
        diagrama, _, _ = cls.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )

        tipo_normalizado = data.tipo.strip().lower()
        if tipo_normalizado not in TIPOS_RELACION_VALIDOS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de relación no válido. Tipos admitidos: {', '.join(TIPOS_RELACION_VALIDOS)}",
            )

        # Validar que ambas clases existen y pertenecen estrictamente al mismo diagrama
        origen = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_clase == data.id_clase_origen, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not origen:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La clase de origen (ID {data.id_clase_origen}) no existe en este diagrama.",
            )

        destino = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_clase == data.id_clase_destino, ClaseUML.id_diagrama == diagrama_id)
            .first()
        )
        if not destino:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La clase de destino (ID {data.id_clase_destino}) no existe en este diagrama.",
            )

        now = datetime.now()
        nueva_rel = RelacionUML(
            id_diagrama=diagrama_id,
            id_clase_origen=data.id_clase_origen,
            id_clase_destino=data.id_clase_destino,
            tipo=tipo_normalizado,
            nombre=data.nombre.strip() if data.nombre else None,
            multiplicidad_origen=data.multiplicidad_origen.strip() if data.multiplicidad_origen else None,
            multiplicidad_destino=data.multiplicidad_destino.strip() if data.multiplicidad_destino else None,
            rol_origen=data.rol_origen.strip() if data.rol_origen else None,
            rol_destino=data.rol_destino.strip() if data.rol_destino else None,
            navegabilidad_origen=data.navegabilidad_origen,
            navegabilidad_destino=data.navegabilidad_destino,
            fecha_creacion=now,
        )
        db.add(nueva_rel)
        diagrama.fecha_modificacion = now
        db.commit()
        db.refresh(nueva_rel)
        return RelacionUMLResponse.model_validate(nueva_rel)

    @classmethod
    def update_relacion(
        cls, db: Session, relacion_id: int, user_id: int, data: RelacionUMLUpdate
    ) -> RelacionUMLResponse:
        rel = db.query(RelacionUML).filter(RelacionUML.id_relacion == relacion_id).first()
        if not rel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Relación UML no encontrada.",
            )

        diagrama, _, _ = cls.get_diagrama_permiso(
            db, rel.id_diagrama, user_id, require_edit=True
        )

        if data.tipo is not None:
            tipo_norm = data.tipo.strip().lower()
            if tipo_norm not in TIPOS_RELACION_VALIDOS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tipo de relación no válido. Tipos admitidos: {', '.join(TIPOS_RELACION_VALIDOS)}",
                )
            rel.tipo = tipo_norm

        if data.nombre is not None:
            rel.nombre = data.nombre.strip() if data.nombre.strip() else None
        if data.multiplicidad_origen is not None:
            rel.multiplicidad_origen = data.multiplicidad_origen.strip() if data.multiplicidad_origen.strip() else None
        if data.multiplicidad_destino is not None:
            rel.multiplicidad_destino = data.multiplicidad_destino.strip() if data.multiplicidad_destino.strip() else None
        if data.rol_origen is not None:
            rel.rol_origen = data.rol_origen.strip() if data.rol_origen.strip() else None
        if data.rol_destino is not None:
            rel.rol_destino = data.rol_destino.strip() if data.rol_destino.strip() else None
        if data.navegabilidad_origen is not None:
            rel.navegabilidad_origen = data.navegabilidad_origen
        if data.navegabilidad_destino is not None:
            rel.navegabilidad_destino = data.navegabilidad_destino

        diagrama.fecha_modificacion = datetime.now()
        db.commit()
        db.refresh(rel)
        return RelacionUMLResponse.model_validate(rel)

    @classmethod
    def delete_relacion(cls, db: Session, relacion_id: int, user_id: int) -> dict:
        rel = db.query(RelacionUML).filter(RelacionUML.id_relacion == relacion_id).first()
        if not rel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Relación UML no encontrada.",
            )

        diagrama, _, _ = cls.get_diagrama_permiso(
            db, rel.id_diagrama, user_id, require_edit=True
        )

        db.delete(rel)
        diagrama.fecha_modificacion = datetime.now()
        db.commit()

        return {
            "message": "Relación UML eliminada correctamente.",
            "id_relacion": relacion_id,
            "id_diagrama": diagrama.id_diagrama,
        }

    # =========================================================================
    # SERIALIZATION HELPERS
    # =========================================================================
    @classmethod
    def _to_clase_response(cls, clase: ClaseUML) -> ClaseUMLResponse:
        attrs = [AtributoUMLResponse.model_validate(a) for a in clase.atributos]
        mets = [
            MetodoUMLResponse(
                id_metodo=m.id_metodo,
                id_clase=m.id_clase,
                nombre=m.nombre,
                tipo_retorno=m.tipo_retorno,
                visibilidad=m.visibilidad,
                es_estatico=m.es_estatico,
                es_abstracto=m.es_abstracto,
                orden=m.orden,
                parametros=[ParametroUMLResponse.model_validate(p) for p in m.parametros],
            )
            for m in clase.metodos
        ]

        return ClaseUMLResponse(
            id_clase=clase.id_clase,
            id_diagrama=clase.id_diagrama,
            nombre=clase.nombre,
            estereotipo=clase.estereotipo,
            visibilidad=clase.visibilidad,
            es_abstracta=clase.es_abstracta,
            posicion_x=float(clase.posicion_x),
            posicion_y=float(clase.posicion_y),
            ancho=float(clase.ancho),
            alto=float(clase.alto),
            fecha_creacion=clase.fecha_creacion,
            fecha_modificacion=clase.fecha_modificacion,
            atributos=attrs,
            metodos=mets,
        )

    @classmethod
    def _build_diagrama_response(
        cls, diagrama: Diagrama, es_propietario: bool, permiso_edicion: bool
    ) -> DiagramaResponse:
        clases_resp = [cls._to_clase_response(c) for c in (diagrama.clases or [])]
        relaciones_resp = [
            RelacionUMLResponse.model_validate(r) for r in (diagrama.relaciones or [])
        ]

        return DiagramaResponse(
            id_diagrama=diagrama.id_diagrama,
            id_proyecto=diagrama.id_proyecto,
            nombre=diagrama.nombre,
            descripcion=diagrama.descripcion,
            version=diagrama.version,
            fecha_creacion=diagrama.fecha_creacion,
            fecha_modificacion=diagrama.fecha_modificacion,
            es_propietario=es_propietario,
            permiso_edicion=permiso_edicion,
            clases=clases_resp,
            relaciones=relaciones_resp,
        )
