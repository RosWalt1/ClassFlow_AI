import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.session import check_db_connection
from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.proyectos import router as proyectos_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("classflow_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup verification
    logger.info("Initializing %s v%s in %s environment...", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)
    db_check = check_db_connection()
    if db_check.get("status") == "connected":
        logger.info("PostgreSQL database connection verified successfully: %s (%s)", db_check.get("database"), db_check.get("version"))
    else:
        logger.warning("PostgreSQL connection verification failed: %s", db_check.get("error"))
    yield
    # Shutdown logic
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend interno de ClassFlow AI para modelado UML colaborativo y generación de backend Spring Boot.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(proyectos_router, prefix=settings.API_V1_PREFIX)
# Also include /health at root for orchestrator convenience
app.include_router(health_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
