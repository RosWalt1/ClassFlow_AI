import json
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE_PATH), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    PROJECT_NAME: str = "ClassFlow AI API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Database: Loaded exclusively from backend/.env or environment variables.
    # Default value is a strictly fictitious placeholder without real credentials.
    DATABASE_URL: str = "postgresql+psycopg://usuario:password@localhost:5432/classflow_ai"

    # JWT Authentication: Obligatoria desde backend/.env o variables de entorno.
    # No se permite ninguna clave secreta funcional en código versionado.
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        cleaned = v.strip() if v else ""
        if not cleaned or "change-this" in cleaned.lower() or "insecure" in cleaned.lower():
            raise ValueError(
                "JWT_SECRET_KEY es obligatoria y debe configurarse exclusivamente en backend/.env o variables de entorno con una clave segura (mínimo 32 caracteres)."
            )
        if len(cleaned) < 32:
            raise ValueError("JWT_SECRET_KEY debe contener al menos 32 caracteres.")
        return cleaned

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.strip().startswith("[") and v.strip().endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()
