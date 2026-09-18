import os
import sys
from pathlib import Path
import pytest
from sqlalchemy import create_engine, text
from urllib.parse import urlparse, urlunparse

# 1. Asegurar explícitamente el entorno de testing antes de importar la aplicación
os.environ["ENVIRONMENT"] = "testing"

# Asegurar que la carpeta backend esté en sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.database import session as db_session
from app.models.base import Base
import app.models  # Registra los 11 modelos en Base.metadata
from app.models.usuario import Usuario
from app.models.proyecto import Proyecto
from app.core.security import get_password_hash


def ensure_test_database_exists(test_db_url: str):
    """Crea la base de datos de pruebas si todavía no existe en PostgreSQL."""
    try:
        parsed = urlparse(test_db_url)
        db_name = parsed.path.lstrip("/")
        admin_url = urlunparse(parsed._replace(path="/postgres"))
        admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": db_name}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
        admin_engine.dispose()
    except Exception:
        # Si no se tiene acceso al catálogo o la BD ya existe, continuar normalmente
        pass


def seed_test_users(target_engine):
    """Garantiza la existencia de los 4 usuarios canónicos en la BD de pruebas."""
    from sqlalchemy.orm import sessionmaker
    TestingSession = sessionmaker(bind=target_engine)
    with TestingSession() as db:
        users_data = [
            {"id_usuario": 1, "nombre": "Carlos", "apellido": "Mendoza", "email": "carlos@classflow.com", "estado": "activo"},
            {"id_usuario": 2, "nombre": "Ana", "apellido": "Lopez", "email": "ana@classflow.com", "estado": "activo"},
            {"id_usuario": 3, "nombre": "Luis", "apellido": "Rojas", "email": "luis@classflow.com", "estado": "activo"},
            {"id_usuario": 4, "nombre": "Usuario Inactivo", "apellido": None, "email": "inactivo@classflow.com", "estado": "inactivo"},
        ]
        default_pwd_hash = get_password_hash("ClassFlow2026!")
        for u in users_data:
            existing = db.query(Usuario).filter(Usuario.email == u["email"]).first()
            if not existing:
                db.add(Usuario(
                    id_usuario=u["id_usuario"],
                    nombre=u["nombre"],
                    apellido=u["apellido"],
                    email=u["email"],
                    password_hash=default_pwd_hash,
                    estado=u["estado"]
                ))
                db.commit()
            else:
                existing.estado = u["estado"]
                existing.password_hash = default_pwd_hash
                db.commit()

        # Sincronizar secuencia del id_usuario
        try:
            db.execute(text("SELECT setval(pg_get_serial_sequence('usuario', 'id_usuario'), coalesce(max(id_usuario), 1)) FROM usuario;"))
            db.commit()
        except Exception:
            pass


def clean_test_data(target_engine):
    """Limpia los proyectos y datos derivados en la BD de pruebas antes de iniciar la suite."""
    with target_engine.connect() as conn:
        conn.execute(text("""
            TRUNCATE TABLE 
                sesion_participante,
                sesion_colaborativa,
                relacion_uml,
                parametro_uml,
                metodo_uml,
                atributo_uml,
                clase_uml,
                diagrama,
                proyecto_colaborador,
                proyecto
            RESTART IDENTITY CASCADE;
        """))
        conn.commit()


def pytest_sessionstart(session):
    """Hook que se ejecuta una sola vez al inicio de pytest.
    Aplica la barrera de seguridad de aislamiento de BD y prepara classflow_ai_test."""
    test_db_url = settings.get_test_database_url()
    ensure_test_database_exists(test_db_url)

    # Reconfigurar el engine global para garantizar que apunte a la BD de test
    db_session.reconfigure_engine(test_db_url)
    engine = db_session.engine

    # --- BARRERA DE SEGURIDAD ESTRICTA ---
    db_name = engine.url.database
    if db_name == "classflow_ai" or "test" not in (db_name or "").lower():
        pytest.exit(
            f"\n\n========================================================================\n"
            f"[ERROR CRITICO DE AISLAMIENTO]: pytest detectó la base de datos '{db_name}'.\n"
            f"Se prohíbe terminantemente ejecutar tests contra la base de desarrollo 'classflow_ai'.\n"
            f"La suite ha sido cancelada sin modificar ni limpiar ninguna tabla.\n"
            f"========================================================================\n",
            returncode=1
        )

    with engine.connect() as conn:
        current_db = conn.execute(text("SELECT current_database()")).scalar()
        if current_db == "classflow_ai" or "test" not in (current_db or "").lower():
            pytest.exit(
                f"\n\n========================================================================\n"
                f"[ERROR CRITICO DE AISLAMIENTO]: Conexión activa reporta '{current_db}'.\n"
                f"Se prohíbe terminantemente ejecutar tests contra la base de desarrollo 'classflow_ai'.\n"
                f"La suite ha sido cancelada sin modificar ni limpiar ninguna tabla.\n"
                f"========================================================================\n",
                returncode=1
            )

    # Crear esquema de 11 tablas en classflow_ai_test
    Base.metadata.create_all(bind=engine)

    # Limpiar datos residuales de tests previos en classflow_ai_test
    clean_test_data(engine)

    # Sembrar usuarios de prueba canónicos
    seed_test_users(engine)


@pytest.fixture(autouse=True)
def guard_against_production_db():
    """Protección por test individual que verifica que jamás se use la BD de desarrollo."""
    engine = db_session.engine
    db_name = engine.url.database
    if db_name == "classflow_ai" or "test" not in (db_name or "").lower():
        pytest.fail(f"Intento de ejecutar prueba contra la base de datos de desarrollo '{db_name}'. Test cancelado.")
