from fastapi import APIRouter, status, Response
from app.core.config import settings
from app.database.session import check_db_connection
from app.schemas.health import HealthResponse, DatabaseHealth

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check del backend y conexión a PostgreSQL",
    description="Verifica el estado del servicio FastAPI y la conexión activa con la base de datos PostgreSQL classflow_ai."
)
def health_check(response: Response) -> HealthResponse:
    db_info = check_db_connection()
    is_connected = db_info.get("status") == "connected"

    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="ok" if is_connected else "error",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=DatabaseHealth(
            status=db_info.get("status", "unknown"),
            database=db_info.get("database"),
            version=db_info.get("version"),
            error=db_info.get("error"),
        ),
    )
