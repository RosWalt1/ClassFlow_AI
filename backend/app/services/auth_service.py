from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.usuario import Usuario
from app.core.security import verify_password


class AuthService:
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Usuario:
        """
        Authenticates a user by email and password.
        Validates active status and updates ultimo_acceso upon success.
        """
        normalized_email = email.strip().lower()
        user = (
            db.query(Usuario)
            .filter(func.lower(Usuario.email) == normalized_email)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.estado != "activo":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo. Acceso denegado.",
            )

        # Update last access timestamp
        user.ultimo_acceso = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[Usuario]:
        return db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
