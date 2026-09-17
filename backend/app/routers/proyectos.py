from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.schemas.proyecto import (
    ProyectoCreate,
    ProyectoUpdate,
    ProyectoResponse,
    ColaboradorCreate,
    ColaboradorUpdate,
    ColaboradorResponse,
)
from app.schemas.auth import MessageResponse
from app.services.proyecto_service import ProyectoService

router = APIRouter(prefix="/proyectos", tags=["Gestión de Proyectos (CU02)"])


@router.post(
    "",
    response_model=ProyectoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un nuevo proyecto UML (CU02)",
    description="Crea un proyecto en PostgreSQL asignando automáticamente como propietario al usuario autenticado.",
)
def create_proyecto(
    data: ProyectoCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProyectoResponse:
    return ProyectoService.create_proyecto(db, current_user, data)


@router.get(
    "",
    response_model=List[ProyectoResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar proyectos accesibles (CU02)",
    description="Retorna los proyectos propios y/o compartidos del usuario autenticado. Permite filtrar por tipo: 'all', 'owner', 'guest'.",
)
def list_proyectos(
    tipo: Optional[str] = Query("all", pattern="^(all|owner|guest)$", description="Filtro de proyectos"),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ProyectoResponse]:
    return ProyectoService.get_proyectos_for_user(db, current_user.id_usuario, tipo or "all")


@router.get(
    "/{id_proyecto}",
    response_model=ProyectoResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar un proyecto específico (CU02)",
    description="Obtiene los datos de un proyecto. Permitido únicamente al propietario o colaboradores activos.",
)
def get_proyecto(
    id_proyecto: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProyectoResponse:
    return ProyectoService.get_proyecto_by_id(db, id_proyecto, current_user.id_usuario)


@router.put(
    "/{id_proyecto}",
    response_model=ProyectoResponse,
    status_code=status.HTTP_200_OK,
    summary="Modificar un proyecto (CU02 - Solo Propietario)",
    description="Actualiza el nombre, descripción o estado de un proyecto. Permitido exclusivamente al propietario.",
)
def update_proyecto(
    id_proyecto: int,
    data: ProyectoUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProyectoResponse:
    return ProyectoService.update_proyecto(db, id_proyecto, current_user.id_usuario, data)


@router.post(
    "/{id_proyecto}/archivar",
    response_model=ProyectoResponse,
    status_code=status.HTTP_200_OK,
    summary="Archivar un proyecto (CU02 - Solo Propietario)",
    description="Cambia el estado del proyecto a 'archivado'. Permitido exclusivamente al propietario.",
)
def archive_proyecto(
    id_proyecto: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProyectoResponse:
    return ProyectoService.archive_proyecto(db, id_proyecto, current_user.id_usuario)


@router.delete(
    "/{id_proyecto}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Eliminar / Archivar proyecto (CU02 - Solo Propietario)",
    description="Marca el proyecto como eliminado de forma controlada. Permitido exclusivamente al propietario.",
)
def delete_proyecto(
    id_proyecto: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    res = ProyectoService.delete_proyecto(db, id_proyecto, current_user.id_usuario)
    return MessageResponse(message=res["message"])


# ============================================================
# SUB-RECURSO: COLABORADORES (CU02)
# ============================================================

@router.get(
    "/{id_proyecto}/colaboradores",
    response_model=List[ColaboradorResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar colaboradores del proyecto (CU02)",
    description="Obtiene la lista de colaboradores participantes en el proyecto. Permitido a propietarios y colaboradores.",
)
def list_colaboradores(
    id_proyecto: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ColaboradorResponse]:
    return ProyectoService.list_colaboradores(db, id_proyecto, current_user.id_usuario)


@router.post(
    "/{id_proyecto}/colaboradores",
    response_model=ColaboradorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invitar / Agregar colaborador (CU02 - Solo Propietario)",
    description="Agrega a un usuario existente como colaborador al proyecto. Permitido exclusivamente al propietario.",
)
def add_colaborador(
    id_proyecto: int,
    data: ColaboradorCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ColaboradorResponse:
    return ProyectoService.add_colaborador(db, id_proyecto, current_user.id_usuario, data)


@router.patch(
    "/{id_proyecto}/colaboradores/{id_colaborador}",
    response_model=ColaboradorResponse,
    status_code=status.HTTP_200_OK,
    summary="Modificar permiso de edición de colaborador (CU02 - Solo Propietario)",
    description="Actualiza el permiso de edición (lectura/escritura) de un colaborador. Permitido exclusivamente al propietario.",
)
def update_colaborador(
    id_proyecto: int,
    id_colaborador: int,
    data: ColaboradorUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ColaboradorResponse:
    return ProyectoService.update_colaborador_permiso(
        db, id_proyecto, id_colaborador, current_user.id_usuario, data
    )


@router.delete(
    "/{id_proyecto}/colaboradores/{id_colaborador}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Revocar colaborador (CU02 - Solo Propietario)",
    description="Revoca y remueve el acceso de un colaborador al proyecto. Permitido exclusivamente al propietario.",
)
def remove_colaborador(
    id_proyecto: int,
    id_colaborador: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    res = ProyectoService.remove_colaborador(
        db, id_proyecto, id_colaborador, current_user.id_usuario
    )
    return MessageResponse(message=res["message"])
