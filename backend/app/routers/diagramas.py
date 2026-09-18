from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.services.diagrama_service import DiagramaService
from app.services.ia_service import IAService
from app.schemas.ia import IAGenerateRequest, IAGenerateResponse
from app.schemas.uml import (
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

router = APIRouter(tags=["Diagramas y Modelado UML (CU03)"])


# =============================================================================
# DIAGRAMAS
# =============================================================================
@router.get(
    "/proyectos/{proyecto_id}/diagrama",
    response_model=DiagramaResponse,
    summary="Obtener o inicializar diagrama principal del proyecto",
    description="Retorna el diagrama UML del proyecto con clases, atributos, métodos, parámetros y relaciones.",
)
def get_diagrama_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.get_or_create_diagrama(
        db=db, proyecto_id=proyecto_id, user_id=current_user.id_usuario
    )


@router.get(
    "/diagramas/{diagrama_id}",
    response_model=DiagramaResponse,
    summary="Obtener diagrama por ID",
    description="Retorna el diagrama UML completo con clases, atributos, métodos, parámetros y relaciones.",
)
def get_diagrama(
    diagrama_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.get_diagrama_by_id(
        db=db, diagrama_id=diagrama_id, user_id=current_user.id_usuario
    )


@router.put(
    "/diagramas/{diagrama_id}",
    response_model=DiagramaResponse,
    summary="Actualizar metadatos del diagrama",
    description="Modifica nombre o descripción del diagrama. Requiere permiso de edición.",
)
def update_diagrama(
    diagrama_id: int,
    data: DiagramaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_diagrama(
        db=db, diagrama_id=diagrama_id, user_id=current_user.id_usuario, data=data
    )


# =============================================================================
# CLASES UML
# =============================================================================
@router.post(
    "/diagramas/{diagrama_id}/clases",
    response_model=ClaseUMLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear clase UML",
    description="Crea una nueva clase UML en el diagrama. Requiere permiso de edición.",
)
def create_clase(
    diagrama_id: int,
    data: ClaseUMLCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.create_clase(
        db=db, diagrama_id=diagrama_id, user_id=current_user.id_usuario, data=data
    )


@router.get(
    "/diagramas/{diagrama_id}/clases/{clase_id}",
    response_model=ClaseUMLResponse,
    summary="Consultar clase UML",
    description="Obtiene los detalles de una clase UML incluyendo atributos y métodos.",
)
def get_clase(
    diagrama_id: int,
    clase_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.get_clase(
        db=db, diagrama_id=diagrama_id, clase_id=clase_id, user_id=current_user.id_usuario
    )


@router.put(
    "/diagramas/{diagrama_id}/clases/{clase_id}",
    response_model=ClaseUMLResponse,
    summary="Modificar clase UML",
    description="Actualiza propiedades de la clase (nombre, visibilidad, abstracta, tamaño). Requiere permiso de edición.",
)
def update_clase(
    diagrama_id: int,
    clase_id: int,
    data: ClaseUMLUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_clase(
        db=db,
        diagrama_id=diagrama_id,
        clase_id=clase_id,
        user_id=current_user.id_usuario,
        data=data,
    )


@router.patch(
    "/diagramas/{diagrama_id}/clases/{clase_id}/posicion",
    response_model=ClaseUMLResponse,
    summary="Actualizar posición X/Y de una clase UML",
    description="Persiste las coordenadas de la clase tras un movimiento en el canvas. Requiere permiso de edición.",
)
def update_clase_posicion(
    diagrama_id: int,
    clase_id: int,
    data: ClaseUMLPosicionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_clase_posicion(
        db=db,
        diagrama_id=diagrama_id,
        clase_id=clase_id,
        user_id=current_user.id_usuario,
        data=data,
    )


@router.delete(
    "/diagramas/{diagrama_id}/clases/{clase_id}",
    summary="Eliminar clase UML",
    description="Elimina una clase UML y sus relaciones de forma segura. Requiere permiso de edición.",
)
def delete_clase(
    diagrama_id: int,
    clase_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.delete_clase(
        db=db, diagrama_id=diagrama_id, clase_id=clase_id, user_id=current_user.id_usuario
    )


# =============================================================================
# ATRIBUTOS UML
# =============================================================================
@router.post(
    "/clases/{clase_id}/atributos",
    response_model=AtributoUMLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar atributo a una clase UML",
    description="Crea un nuevo atributo en la clase especificada. Requiere permiso de edición.",
)
def create_atributo(
    clase_id: int,
    data: AtributoUMLCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.create_atributo(
        db=db, clase_id=clase_id, user_id=current_user.id_usuario, data=data
    )


@router.put(
    "/atributos/{atributo_id}",
    response_model=AtributoUMLResponse,
    summary="Modificar atributo UML",
    description="Actualiza nombre, tipo, visibilidad o modificadores de un atributo. Requiere permiso de edición.",
)
def update_atributo(
    atributo_id: int,
    data: AtributoUMLUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_atributo(
        db=db, atributo_id=atributo_id, user_id=current_user.id_usuario, data=data
    )


@router.delete(
    "/atributos/{atributo_id}",
    summary="Eliminar atributo UML",
    description="Elimina un atributo de su clase correspondiente. Requiere permiso de edición.",
)
def delete_atributo(
    atributo_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.delete_atributo(
        db=db, atributo_id=atributo_id, user_id=current_user.id_usuario
    )


# =============================================================================
# MÉTODOS Y PARÁMETROS UML
# =============================================================================
@router.post(
    "/clases/{clase_id}/metodos",
    response_model=MetodoUMLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar método a una clase UML",
    description="Crea una nueva operación en la clase especificada. Requiere permiso de edición.",
)
def create_metodo(
    clase_id: int,
    data: MetodoUMLCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.create_metodo(
        db=db, clase_id=clase_id, user_id=current_user.id_usuario, data=data
    )


@router.put(
    "/metodos/{metodo_id}",
    response_model=MetodoUMLResponse,
    summary="Modificar método UML",
    description="Actualiza nombre, retorno, visibilidad o modificadores de un método. Requiere permiso de edición.",
)
def update_metodo(
    metodo_id: int,
    data: MetodoUMLUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_metodo(
        db=db, metodo_id=metodo_id, user_id=current_user.id_usuario, data=data
    )


@router.delete(
    "/metodos/{metodo_id}",
    summary="Eliminar método UML",
    description="Elimina un método y sus parámetros. Requiere permiso de edición.",
)
def delete_metodo(
    metodo_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.delete_metodo(
        db=db, metodo_id=metodo_id, user_id=current_user.id_usuario
    )


@router.post(
    "/metodos/{metodo_id}/parametros",
    response_model=ParametroUMLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar parámetro a un método UML",
    description="Agrega un parámetro a la signatura del método. Requiere permiso de edición.",
)
def create_parametro(
    metodo_id: int,
    data: ParametroUMLCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.create_parametro(
        db=db, metodo_id=metodo_id, user_id=current_user.id_usuario, data=data
    )


@router.put(
    "/parametros/{parametro_id}",
    response_model=ParametroUMLResponse,
    summary="Modificar parámetro UML",
    description="Actualiza nombre, tipo o valor por defecto de un parámetro. Requiere permiso de edición.",
)
def update_parametro(
    parametro_id: int,
    data: ParametroUMLUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_parametro(
        db=db, parametro_id=parametro_id, user_id=current_user.id_usuario, data=data
    )


@router.delete(
    "/parametros/{parametro_id}",
    summary="Eliminar parámetro UML",
    description="Elimina un parámetro de la signatura del método. Requiere permiso de edición.",
)
def delete_parametro(
    parametro_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.delete_parametro(
        db=db, parametro_id=parametro_id, user_id=current_user.id_usuario
    )


# =============================================================================
# RELACIONES UML
# =============================================================================
@router.post(
    "/diagramas/{diagrama_id}/relaciones",
    response_model=RelacionUMLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear relación UML",
    description="Crea una relación entre dos clases del mismo diagrama. Requiere permiso de edición.",
)
def create_relacion(
    diagrama_id: int,
    data: RelacionUMLCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.create_relacion(
        db=db, diagrama_id=diagrama_id, user_id=current_user.id_usuario, data=data
    )


@router.put(
    "/relaciones/{relacion_id}",
    response_model=RelacionUMLResponse,
    summary="Modificar relación UML",
    description="Actualiza tipo, nombre, multiplicidades o roles de la relación. Requiere permiso de edición.",
)
def update_relacion(
    relacion_id: int,
    data: RelacionUMLUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.update_relacion(
        db=db, relacion_id=relacion_id, user_id=current_user.id_usuario, data=data
    )


@router.delete(
    "/relaciones/{relacion_id}",
    summary="Eliminar relación UML",
    description="Elimina una relación entre clases. Requiere permiso de edición.",
)
def delete_relacion(
    relacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DiagramaService.delete_relacion(
        db=db, relacion_id=relacion_id, user_id=current_user.id_usuario
    )


# =============================================================================
# INTELIGENCIA ARTIFICIAL (CU05)
# =============================================================================
@router.post(
    "/diagramas/{diagrama_id}/ia/generar",
    response_model=IAGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generar y aplicar elementos UML mediante IA (CU05)",
    description="Interpreta una instrucción en lenguaje natural, consulta a Gemini, valida el esquema UML y persiste los elementos en PostgreSQL con rollback atómico.",
)
def generar_diagrama_ia(
    diagrama_id: int,
    request: IAGenerateRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return IAService.generar_y_aplicar_propuesta(
        db=db,
        diagrama_id=diagrama_id,
        user_id=current_user.id_usuario,
        prompt=request.prompt,
    )

