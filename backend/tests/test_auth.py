from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.database.session import SessionLocal
from app.models.usuario import Usuario

client = TestClient(app)


def test_login_valid_credentials():
    """1. Login con credenciales válidas."""
    response = client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "ClassFlow2026!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
    assert data["user"]["email"] == "carlos@classflow.com"
    assert data["user"]["nombre"] == "Carlos"
    assert data["user"]["estado"] == "activo"


def test_login_wrong_password():
    """2. Login con contraseña incorrecta."""
    response = client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "WrongPassword123!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "Credenciales incorrectas"


def test_login_nonexistent_user():
    """3. Login con usuario inexistente."""
    response = client.post(
        "/api/auth/login",
        json={"email": "noexiste@classflow.com", "password": "ClassFlow2026!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "Credenciales incorrectas"


def test_login_inactive_user():
    """4. Login con usuario inactivo."""
    response = client.post(
        "/api/auth/login",
        json={"email": "inactivo@classflow.com", "password": "ClassFlow2026!"},
    )
    assert response.status_code == 403
    data = response.json()
    assert "inactivo" in data["detail"].lower()


def test_get_me_valid_token():
    """5. GET /api/auth/me con token válido."""
    # First login to get a real token
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "ana@classflow.com", "password": "ClassFlow2026!"},
    )
    token = login_resp.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "ana@classflow.com"
    assert data["nombre"] == "Ana"
    assert data["estado"] == "activo"


def test_get_me_without_auth():
    """6. GET /api/auth/me sin autenticación."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert "no proporcionado" in data["detail"].lower() or "autenticación requerida" in data["detail"].lower()


def test_get_me_invalid_token():
    """7. Token inválido."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer token.invalido.ficticio123"},
    )
    assert response.status_code == 401
    data = response.json()
    assert "inválido" in data["detail"].lower()


def test_get_me_expired_token():
    """8. Token expirado."""
    # Generate token that expired 10 minutes ago
    expired_token = create_access_token(
        subject="1",
        claims={"email": "carlos@classflow.com"},
        expires_delta=timedelta(minutes=-10),
    )
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    data = response.json()
    assert "expirado" in data["detail"].lower()


def test_ultimo_acceso_updated():
    """9. Actualización de ultimo_acceso en PostgreSQL."""
    db = SessionLocal()
    user_before = db.query(Usuario).filter(Usuario.email == "carlos@classflow.com").first()
    prev_access = user_before.ultimo_acceso
    db.close()

    # Perform login
    client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "ClassFlow2026!"},
    )

    db = SessionLocal()
    user_after = db.query(Usuario).filter(Usuario.email == "carlos@classflow.com").first()
    new_access = user_after.ultimo_acceso
    db.close()

    assert new_access is not None
    if prev_access is not None:
        assert new_access >= prev_access


def test_logout():
    """10. Endpoint de logout."""
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "ClassFlow2026!"},
    )
    token = login_resp.json()["access_token"]

    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "correctamente" in data["message"].lower()
