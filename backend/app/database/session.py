from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=(settings.ENVIRONMENT == "development_debug"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides an independent SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> dict:
    """Verifies that PostgreSQL is reachable and returns basic server info."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT current_database(), version()"))
            row = result.fetchone()
            return {
                "status": "connected",
                "database": row[0] if row else "unknown",
                "version": row[1].split()[0] + " " + row[1].split()[1] if row else "unknown",
            }
    except Exception as exc:
        return {
            "status": "disconnected",
            "error": str(exc),
        }
