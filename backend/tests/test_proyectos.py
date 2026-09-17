import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.proyecto import Proyecto, ProyectoColaborador

client = TestClient(app)


@pytest.fixture(scope="module")
def tokens():
    """Autentica a los usuarios de prueba y retorna sus tokens JWT."""
    # Carlos (Propietario)
    res_carlos = client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "ClassFlow2026!"},
    )
    assert res_carlos.status_code == 200, f"Login carlos falló: {res_carlos.text}"
    token_carlos = res_carlos.json()["access_token"]
    user_carlos = res_carlos.json()["user"]

    # Ana (Invitado / Colaborador)
    res_ana = client.post(
        "/api/auth/login",
        json={"email": "ana@classflow.com", "password": "ClassFlow2026!"},
    )
    assert res_ana.status_code == 200, f"Login ana falló: {res_ana.text}"
    token_ana = res_ana.json()["access_token"]
    user_ana = res_ana.json()["user"]

    # Luis (Tercero / Usuario ajeno a proyectos privados)
    res_luis = client.post(
        "/api/auth/login",
        json={"email": "luis@classflow.com", "password": "ClassFlow2026!"},
    )
    assert res_luis.status_code == 200, f"Login luis falló: {res_luis.text}"
    token_luis = res_luis.json()["access_token"]
    user_luis = res_luis.json()["user"]

    return {
        "carlos": token_carlos,
        "carlos_user": user_carlos,
        "ana": token_ana,
        "ana_user": user_ana,
        "luis": token_luis,
        "luis_user": user_luis,
    }


def test_endpoint_sin_jwt_retorna_401():
    """Endpoint sin JWT retorna 401."""
    res = client.get("/api/proyectos")
    assert res.status_code == 401


def test_crear_proyecto_y_verificar_propietario(tokens):
    """1 y 2. Crear proyecto autenticado y verificar que el creador quede como propietario."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}
    payload = {
        "nombre": "[TEST-CU02] Microservicio Pagos",
        "descripcion": "Gestión de transacciones y conciliación bancaria",
    }
    res = client.post("/api/proyectos", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["nombre"] == payload["nombre"]
    assert data["id_propietario"] == tokens["carlos_user"]["id_usuario"]
    assert data["es_propietario"] is True
    assert data["rol"] == "Propietario"
    assert data["estado"] == "activo"


def test_listar_y_consultar_proyectos_propios(tokens):
    """3 y 4. Listar proyectos propios y consultar proyecto propio."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    # Listar
    res_list = client.get("/api/proyectos?tipo=owner", headers=headers)
    assert res_list.status_code == 200
    projs = res_list.json()
    assert isinstance(projs, list)
    assert len(projs) > 0
    test_proj = next((p for p in projs if "[TEST-CU02] Microservicio Pagos" in p["nombre"]), None)
    assert test_proj is not None

    # Consultar individual
    res_get = client.get(f"/api/proyectos/{test_proj['id_proyecto']}", headers=headers)
    assert res_get.status_code == 200
    p_data = res_get.json()
    assert p_data["id_proyecto"] == test_proj["id_proyecto"]
    assert p_data["nombre"] == test_proj["nombre"]


def test_editar_proyecto_y_persistencia(tokens):
    """5 y 6. Editar proyecto como propietario y verificar persistencia tras volver a consultar."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    # Crear proyecto para editar
    res_create = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto a Editar", "descripcion": "Desc original"},
        headers=headers,
    )
    proj_id = res_create.json()["id_proyecto"]

    # Editar
    update_payload = {
        "nombre": "[TEST-CU02] Proyecto Editado Exitosamente",
        "descripcion": "Nueva descripcion actualizada",
    }
    res_update = client.put(f"/api/proyectos/{proj_id}", json=update_payload, headers=headers)
    assert res_update.status_code == 200
    assert res_update.json()["nombre"] == update_payload["nombre"]
    assert res_update.json()["descripcion"] == update_payload["descripcion"]

    # Consultar nuevamente en la base de datos
    res_check = client.get(f"/api/proyectos/{proj_id}", headers=headers)
    assert res_check.status_code == 200
    assert res_check.json()["nombre"] == update_payload["nombre"]
    assert res_check.json()["descripcion"] == update_payload["descripcion"]


def test_gestion_colaboradores(tokens):
    """7, 8, 9 y 10. Agregar, listar, modificar permisos y revocar colaborador."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}

    # Crear proyecto para prueba de colaboradores
    res_proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto Colaboracion", "descripcion": "Colab test"},
        headers=headers_carlos,
    )
    proj_id = res_proj.json()["id_proyecto"]

    # 7. Agregar colaborador existente (Ana)
    res_add = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )
    assert res_add.status_code == 201
    colab_data = res_add.json()
    assert colab_data["email"] == "ana@classflow.com"
    assert colab_data["permiso_edicion"] is True
    colab_id = colab_data["id_colaborador"]

    # 8. Listar colaboradores
    res_list = client.get(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_carlos)
    assert res_list.status_code == 200
    colabs = res_list.json()
    assert any(c["id_colaborador"] == colab_id for c in colabs)

    # 9. Modificar permiso_edicion
    res_patch = client.patch(
        f"/api/proyectos/{proj_id}/colaboradores/{colab_id}",
        json={"permiso_edicion": False},
        headers=headers_carlos,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["permiso_edicion"] is False

    # 10. Revocar colaborador
    res_del = client.delete(
        f"/api/proyectos/{proj_id}/colaboradores/{colab_id}",
        headers=headers_carlos,
    )
    assert res_del.status_code == 200
    assert "revocado" in res_del.json()["message"].lower()

    # Comprobar que ya no aparece en la lista de colaboradores activos
    res_list_after = client.get(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_carlos)
    assert not any(c["id_colaborador"] == colab_id for c in res_list_after.json())


def test_validaciones_colaborador(tokens):
    """11, 12, 13. Evitar duplicado, evitar agregar propietario y rechazar usuario inexistente."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    res_proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto Validaciones", "descripcion": "Validations"},
        headers=headers,
    )
    proj_id = res_proj.json()["id_proyecto"]

    # 12. Evitar agregar al propietario como colaborador -> 400
    res_owner = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "carlos@classflow.com", "permiso_edicion": True},
        headers=headers,
    )
    assert res_owner.status_code == 400
    assert "propietario" in res_owner.json()["detail"].lower()

    # 13. Rechazar usuario inexistente -> 404
    res_nonexistent = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "usuario.inexistente@noexiste.com", "permiso_edicion": True},
        headers=headers,
    )
    assert res_nonexistent.status_code == 404

    # 11. Evitar colaborador duplicado
    # Primero agregar a Ana
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers,
    )
    # Intentar agregar a Ana nuevamente -> 400
    res_dup = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers,
    )
    assert res_dup.status_code == 400
    assert "ya es colaborador" in res_dup.json()["detail"].lower()


def test_acceso_colaborador_compartido(tokens):
    """14 y 15. Colaborador activo puede consultar proyecto compartido y aparece en su lista."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}

    # Carlos crea proyecto
    res_proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto Compartido con Ana", "descripcion": "Compartido"},
        headers=headers_carlos,
    )
    proj_id = res_proj.json()["id_proyecto"]

    # Carlos invita a Ana
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )

    # 14. Ana consulta el proyecto
    res_ana_get = client.get(f"/api/proyectos/{proj_id}", headers=headers_ana)
    assert res_ana_get.status_code == 200
    ana_proj = res_ana_get.json()
    assert ana_proj["id_proyecto"] == proj_id
    assert ana_proj["es_propietario"] is False
    assert ana_proj["rol"] == "Invitado"

    # 15. Proyecto aparece en la lista de Ana (tipo=guest)
    res_ana_list = client.get("/api/proyectos?tipo=guest", headers=headers_ana)
    assert res_ana_list.status_code == 200
    guest_projs = res_ana_list.json()
    assert any(p["id_proyecto"] == proj_id for p in guest_projs)


def test_impedir_operaciones_exclusivas_a_colaborador(tokens):
    """16, 17, 18. Impedir que colaborador modifique, archive o administre participantes."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}

    # Carlos crea proyecto e invita a Ana
    res_proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto Protegido", "descripcion": "Protected"},
        headers=headers_carlos,
    )
    proj_id = res_proj.json()["id_proyecto"]
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )

    # 16. Ana intenta modificar proyecto -> 403 Forbidden
    res_mod = client.put(
        f"/api/proyectos/{proj_id}",
        json={"nombre": "Nombre alterado por Ana"},
        headers=headers_ana,
    )
    assert res_mod.status_code == 403
    assert "solo el propietario" in res_mod.json()["detail"].lower()

    # 17. Ana intenta archivar / eliminar proyecto -> 403 Forbidden
    res_del = client.delete(f"/api/proyectos/{proj_id}", headers=headers_ana)
    assert res_del.status_code == 403
    assert "solo el propietario" in res_del.json()["detail"].lower()

    res_arc = client.post(f"/api/proyectos/{proj_id}/archivar", headers=headers_ana)
    assert res_arc.status_code == 403
    assert "solo el propietario" in res_arc.json()["detail"].lower()

    # 18. Ana intenta invitar a otro colaborador (Luis) -> 403 Forbidden
    res_inv = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "luis@classflow.com", "permiso_edicion": True},
        headers=headers_ana,
    )
    assert res_inv.status_code == 403
    assert "solo el propietario" in res_inv.json()["detail"].lower()


def test_impedir_acceso_usuario_ajeno(tokens):
    """19. Impedir acceso de usuario ajeno no invitado."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_luis = {"Authorization": f"Bearer {tokens['luis']}"}

    # Carlos crea proyecto privado sin invitar a Luis
    res_proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-CU02] Proyecto Confidencial", "descripcion": "Privado"},
        headers=headers_carlos,
    )
    proj_id = res_proj.json()["id_proyecto"]

    # Luis intenta acceder al proyecto -> 403 Forbidden
    res_luis_get = client.get(f"/api/proyectos/{proj_id}", headers=headers_luis)
    assert res_luis_get.status_code == 403
    assert "permiso" in res_luis_get.json()["detail"].lower()

    # Luis tampoco debe ver este proyecto en su lista
    res_luis_list = client.get("/api/proyectos?tipo=all", headers=headers_luis)
    assert not any(p["id_proyecto"] == proj_id for p in res_luis_list.json())


def test_proyecto_inexistente_retorna_404(tokens):
    """21. Proyecto inexistente retorna 404."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}
    res = client.get("/api/proyectos/999999", headers=headers)
    assert res.status_code == 404
    assert "no encontrado" in res.json()["detail"].lower()
