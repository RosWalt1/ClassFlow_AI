from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, MessageResponse
from app.services.auth_service import AuthService
from app.core.security import create_access_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Autenticación (CU01)"])


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión (CU01)",
    description="Autentica al usuario contra PostgreSQL classflow_ai mediante correo y contraseña segura. Retorna token JWT y perfil del usuario.",
)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = AuthService.authenticate_user(db, request.email, request.password)
    
    expires_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        subject=user.id_usuario,
        claims={
            "email": user.email,
            "nombre": user.nombre,
        },
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_minutes * 60,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener usuario autenticado actual",
    description="Retorna la información del usuario autenticado a partir del token JWT Bearer en el encabezado Authorization.",
)
def get_me(current_user: Usuario = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Cerrar sesión",
    description="Invalida la sesión del lado del cliente y confirma el cierre de sesión seguro.",
)
def logout(current_user: Usuario = Depends(get_current_user)) -> MessageResponse:
    return MessageResponse(message="Sesión cerrada correctamente.")
