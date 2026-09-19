import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.uml import ClaseUML, AtributoUML, RelacionUML
from app.services.voice_service import VoiceService
from app.services.diagrama_service import DiagramaService

client = TestClient(app)


# =============================================================================
# FIXTURES Y HELPERS
# =============================================================================
@pytest.fixture(autouse=True)
def cleanup_mock_voice():
    """Asegura que cada test restablezca el estado de VoiceService."""
    yield
    VoiceService.reset_mocks()


def get_token(email: str, password: str = "ClassFlow2026!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-VOZ] Proyecto Voz") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc"})
    assert res_p.status_code == 201
    proj_id = res_p.json()["id_proyecto"]

    res_d = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res_d.status_code == 200
    diag_id = res_d.json()["id_diagrama"]
    return proj_id, diag_id


# =============================================================================
# PRUEBAS OFICIALES DE FASE 7 — CU06 GESTIONAR DIAGRAMA MEDIANTE VOZ
# =============================================================================

def test_1_crear_clase_factura_voz():
    """1. 'Agrega una clase FacturaVoz' -> add_class FacturaVoz persistida en PostgreSQL."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] FacturaVoz")

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Agrega una clase FacturaVoz."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["operation"] == "add_class"
    assert data["transcripcion"] == "Agrega una clase FacturaVoz"
    assert "FacturaVoz" in data["message"]

    with SessionLocal() as db:
        clase = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "FacturaVoz").first()
        assert clase is not None
        assert clase.nombre == "FacturaVoz"
        # Atributo id por defecto
        attrs = [a.nombre for a in clase.atributos]
        assert "id" in attrs


def test_2_crear_clase_mascota_variable():
    """2. 'Agrega una clase Mascota' -> crea Mascota demostrando nombre variable sin hardcoding."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Mascota")

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Agrega una clase Mascota"},
    )
    assert res.status_code == 200
    assert res.json()["operation"] == "add_class"
    assert "Mascota" in res.json()["message"]

    with SessionLocal() as db:
        clase = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Mascota").first()
        assert clase is not None
        assert clase.nombre == "Mascota"


def test_3_agregar_atributo_correo_string_a_cliente():
    """3. 'Agrega un atributo correo String a Cliente' -> add_attribute en clase existente."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Add Attr")

    # Crear clase previa
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente"})
    assert res_c.status_code == 201
    cliente_id = res_c.json()["id_clase"]

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Agrega un atributo correo String a Cliente"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["operation"] == "add_attribute"
    assert "correo" in data["message"]

    with SessionLocal() as db:
        attr = db.query(AtributoUML).filter(AtributoUML.id_clase == cliente_id, AtributoUML.nombre == "correo").first()
        assert attr is not None
        assert attr.tipo_dato == "String"


def test_4_eliminar_atributo_telefono_de_cliente():
    """4. 'Elimina el atributo telefono de Cliente' -> remove_attribute con normalización de acentos."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Remove Attr")

    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente"})
    cliente_id = res_c.json()["id_clase"]

    client.post(f"/api/clases/{cliente_id}/atributos", headers=headers, json={"nombre": "telefono", "tipo_dato": "String"})

    # Eliminar usando versión con acento en la transcripción
    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Elimina el atributo teléfono de Cliente"},
    )
    assert res.status_code == 200
    assert res.json()["operation"] == "remove_attribute"

    with SessionLocal() as db:
        attr = db.query(AtributoUML).filter(AtributoUML.id_clase == cliente_id, AtributoUML.nombre == "telefono").first()
        assert attr is None


def test_5_relacionar_cliente_con_venta_uno_a_muchos():
    """5. 'Relaciona Cliente con Venta uno a muchos' -> create_relation 1 a 0..*."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Relacion")

    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente"})
    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Venta"})

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Relaciona Cliente con Venta uno a muchos"},
    )
    assert res.status_code == 200
    assert res.json()["operation"] == "create_relation"

    with SessionLocal() as db:
        rel = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).first()
        assert rel is not None
        assert rel.multiplicidad_origen == "1"
        assert rel.multiplicidad_destino == "0..*"


def test_6_frase_desconocida_rechazada_sin_mutacion():
    """6. Frase que no coincide con las 4 estructuras oficiales es rechazada con 400 sin mutar la BD."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Frase Desconocida")

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Genera un reporte mensual de ventas."},
    )
    assert res.status_code == 400
    assert "no reconocido" in res.json()["detail"].lower()

    with SessionLocal() as db:
        classes_count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert classes_count == 0


def test_7_colaborador_read_only_recibe_403():
    """7. Colaborador solo lectura recibe 403 Forbidden al intentar ejecutar comando de voz."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_l = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU06] Read Only")
    client.post(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_c, json={"email": "luis@classflow.com", "permiso_edicion": False})

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers_l,
        json={"transcripcion": "Agrega una clase Bloqueada"},
    )
    assert res.status_code == 403
    assert "permiso de edición" in res.json()["detail"].lower()


def test_8_colaborador_editor_puede_ejecutar():
    """8. Colaborador con permiso_edicion=True puede ejecutar comando de voz."""
    token_carlos = get_token("carlos@classflow.com")
    token_ana = get_token("ana@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_a = {"Authorization": f"Bearer {token_ana}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU06] Colaborador Editor")
    client.post(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_c, json={"email": "ana@classflow.com", "permiso_edicion": True})

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers_a,
        json={"transcripcion": "Agrega una clase Colaborativa"},
    )
    assert res.status_code == 200
    assert res.json()["operation"] == "add_class"


def test_9_fallo_duplicado_produce_rollback():
    """9. Fallo al intentar crear una clase duplicada produce rollback atómico."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Rollback Duplicado")

    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Unica"})

    res = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Agrega una clase Unica"},
    )
    assert res.status_code == 400
    assert "ya existe una clase llamada 'unica'" in res.json()["detail"].lower()

    with SessionLocal() as db:
        cnt = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Unica").count()
        assert cnt == 1


def test_10_diagram_changed_solo_ocurre_tras_commit(monkeypatch):
    """10. La notificación WebSocket diagram.changed se emite únicamente tras el commit exitoso."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU06] Notify")

    notified = []

    def mock_notify(diagrama_id: int, user_id: int):
        notified.append((diagrama_id, user_id))

    monkeypatch.setattr(DiagramaService, "_notify_diagram_changed", mock_notify)

    # Fallo -> no emite
    res_fail = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Comando invalido"},
    )
    assert res_fail.status_code == 400
    assert len(notified) == 0

    # Éxito -> emite 1 vez
    res_ok = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers=headers,
        json={"transcripcion": "Agrega una clase Notificada"},
    )
    assert res_ok.status_code == 200
    assert len(notified) == 1
    assert notified[0][0] == diag_id


def test_11_requiere_autenticacion_jwt():
    """11. El endpoint exige token JWT válido."""
    token = get_token("carlos@classflow.com")
    _, diag_id = create_project_and_diagram({"Authorization": f"Bearer {token}"}, "[CU06] Auth")

    # Sin token
    res_no_auth = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        json={"transcripcion": "Agrega una clase Publica"},
    )
    assert res_no_auth.status_code == 401

    # Token inválido
    res_bad_token = client.post(
        f"/api/diagramas/{diag_id}/voz/comando",
        headers={"Authorization": "Bearer token_falso_invalido"},
        json={"transcripcion": "Agrega una clase Publica"},
    )
    assert res_bad_token.status_code == 401
