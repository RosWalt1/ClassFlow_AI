import json
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.session import SessionLocal, engine
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.services.ia_service import IAService

client = TestClient(app)


# =============================================================================
# FIXTURES Y HELPERS
# =============================================================================
@pytest.fixture(autouse=True)
def cleanup_mock_ia():
    """Asegura que cada test restablezca el mock de IA."""
    yield
    IAService.reset_mocks()


def get_token(email: str, password: str = "ClassFlow2026!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-IA] Proyecto IA") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc"})
    assert res_p.status_code == 201
    proj_id = res_p.json()["id_proyecto"]

    res_d = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res_d.status_code == 200
    diag_id = res_d.json()["id_diagrama"]
    return proj_id, diag_id


# =============================================================================
# PRUEBAS DE FASE 6 — CU05 CREAR DIAGRAMA MEDIANTE IA
# =============================================================================
def test_ia_propietario_genera_diagrama_valido_exitosamente():
    """1. El propietario puede generar clases, atributos, métodos, parámetros y relaciones válidas."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    proj_id, diag_id = create_project_and_diagram(headers, "[TEST-IA] E-commerce")

    mock_proposal = {
        "classes": [
            {
                "nombre": "Cliente",
                "estereotipo": "«entity»",
                "visibilidad": "public",
                "es_abstracta": False,
                "atributos": [
                    {"nombre": "id", "tipo_dato": "Long", "visibilidad": "private", "es_nullable": False},
                    {"nombre": "nombre", "tipo_dato": "String", "visibilidad": "private", "es_nullable": False},
                    {"nombre": "correo", "tipo_dato": "String", "visibilidad": "private", "es_nullable": True},
                ],
                "metodos": [
                    {
                        "nombre": "actualizarCorreo",
                        "tipo_retorno": "void",
                        "visibilidad": "public",
                        "parametros": [{"nombre": "nuevoCorreo", "tipo_dato": "String"}],
                    }
                ],
            },
            {
                "nombre": "Pedido",
                "estereotipo": "«entity»",
                "visibilidad": "public",
                "es_abstracta": False,
                "atributos": [
                    {"nombre": "id", "tipo_dato": "Long", "visibilidad": "private"},
                    {"nombre": "total", "tipo_dato": "Double", "visibilidad": "private"},
                ],
                "metodos": [],
            },
        ],
        "relations": [
            {
                "origen": "Cliente",
                "destino": "Pedido",
                "tipo": "asociacion",
                "nombre": "realiza",
                "multiplicidad_origen": "1",
                "multiplicidad_destino": "0..*",
            }
        ],
    }

    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea la clase Cliente y la clase Pedido con su relación."},
    )

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "Cliente" in data["created_classes"]
    assert "Pedido" in data["created_classes"]
    assert data["created_relations"] == 1
    assert data["total_classes"] >= 2

    # Verificar en PostgreSQL (classflow_ai_test)
    db: Session = SessionLocal()
    try:
        cliente_db = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Cliente").first()
        pedido_db = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Pedido").first()
        assert cliente_db is not None
        assert pedido_db is not None
        assert len(cliente_db.atributos) == 3
        assert len(cliente_db.metodos) == 1
        assert len(cliente_db.metodos[0].parametros) == 1
        assert cliente_db.metodos[0].parametros[0].nombre == "nuevoCorreo"

        rel_db = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).first()
        assert rel_db is not None
        assert rel_db.id_clase_origen == cliente_db.id_clase
        assert rel_db.id_clase_destino == pedido_db.id_clase
        assert rel_db.tipo == "asociacion"
        assert rel_db.nombre == "realiza"
    finally:
        db.close()


def test_ia_posicionamiento_inicial_determinista():
    """2. Las clases generadas tienen coordenadas iniciales en grilla y no se superponen en (0,0)."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Posiciones")

    mock_proposal = {
        "classes": [
            {"nombre": "ClaseA", "atributos": [], "metodos": []},
            {"nombre": "ClaseB", "atributos": [], "metodos": []},
            {"nombre": "ClaseC", "atributos": [], "metodos": []},
            {"nombre": "ClaseD", "atributos": [], "metodos": []},
        ],
        "relations": [],
    }

    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea 4 clases."},
    )
    assert res.status_code == 200

    db: Session = SessionLocal()
    try:
        clases = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).all()
        positions = [(float(c.posicion_x), float(c.posicion_y)) for c in clases]
        # Ninguna posición debe ser (0, 0)
        for x, y in positions:
            assert x > 0 and y > 0
        # Todas las posiciones deben ser distintas (sin solapamiento exacto)
        assert len(set(positions)) == len(positions)
    finally:
        db.close()


def test_ia_invitado_con_permiso_edicion_puede_generar():
    """3. Desarrollador invitado activo con permiso_edicion=True puede usar IA."""
    token_carlos = get_token("carlos@classflow.com")
    token_ana = get_token("ana@classflow.com")
    headers_carlos = {"Authorization": f"Bearer {token_carlos}"}
    headers_ana = {"Authorization": f"Bearer {token_ana}"}

    proj_id, diag_id = create_project_and_diagram(headers_carlos, "[TEST-IA] Colab Edicion")

    # Invitar a Ana con permiso_edicion=True
    res_inv = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_carlos,
        json={"email": "ana@classflow.com", "permiso_edicion": True},
    )
    assert res_inv.status_code == 201

    mock_proposal = {
        "classes": [{"nombre": "Factura", "atributos": [], "metodos": []}],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    # Ana genera mediante IA
    res_ana = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers_ana,
        json={"prompt": "Crea la clase Factura."},
    )
    assert res_ana.status_code == 200
    assert "Factura" in res_ana.json()["created_classes"]


def test_ia_invitado_solo_lectura_recibe_403():
    """4. Desarrollador invitado activo con permiso_edicion=False recibe 403 Forbidden en backend."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_carlos = {"Authorization": f"Bearer {token_carlos}"}
    headers_luis = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_carlos, "[TEST-IA] Colab ReadOnly")

    # Invitar a Luis en solo lectura (permiso_edicion=False)
    res_inv = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_carlos,
        json={"email": "luis@classflow.com", "permiso_edicion": False},
    )
    assert res_inv.status_code == 201

    mock_proposal = {
        "classes": [{"nombre": "IntentoBloqueado", "atributos": [], "metodos": []}],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    # Luis intenta generar mediante IA
    res_luis = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers_luis,
        json={"prompt": "Crea una clase."},
    )
    assert res_luis.status_code == 403
    assert "permiso de edición" in res_luis.json()["detail"].lower()


def test_ia_usuario_ajeno_recibe_403():
    """5. Usuario ajeno sin invitación recibe 403 Forbidden."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_carlos = {"Authorization": f"Bearer {token_carlos}"}
    headers_luis = {"Authorization": f"Bearer {token_luis}"}

    _, diag_id = create_project_and_diagram(headers_carlos, "[TEST-IA] Privado")

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers_luis,
        json={"prompt": "Crea clase en proyecto ajeno."},
    )
    assert res.status_code == 403


def test_ia_sin_jwt_recibe_401():
    """6. Petición sin token JWT recibe 401 Unauthorized."""
    res = client.post("/api/diagramas/1/ia/generar", json={"prompt": "Crea clase."})
    assert res.status_code == 401


def test_ia_rechaza_tipo_relacion_invalido():
    """7. Tipo de relación no soportado (fuera de los 6 oficiales) es rechazado sin modificar BD."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Rel Invalida")

    mock_invalid_rel = {
        "classes": [
            {"nombre": "ClaseUno", "atributos": [], "metodos": []},
            {"nombre": "ClaseDos", "atributos": [], "metodos": []},
        ],
        "relations": [
            {"origen": "ClaseUno", "destino": "ClaseDos", "tipo": "tipo_inexistente_inventado"}
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_invalid_rel))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea dos clases relacionadas."},
    )
    assert res.status_code in (400, 422)

    # Verificar que NINGUNA clase fue guardada (rollback / sin efectos secundarios)
    db: Session = SessionLocal()
    try:
        count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert count == 0
    finally:
        db.close()


def test_ia_rechaza_relacion_hacia_clase_inexistente():
    """8. Relación hacia una clase que no existe en el diagrama ni en la propuesta es rechazada."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Target Fantasma")

    mock_invalid_target = {
        "classes": [{"nombre": "ClaseReal", "atributos": [], "metodos": []}],
        "relations": [{"origen": "ClaseReal", "destino": "ClaseFantasma", "tipo": "asociacion"}],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_invalid_target))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea clase y relación."},
    )
    assert res.status_code == 400
    assert "no existe" in res.json()["detail"].lower()

    # Comprobar que no se persistió nada
    db: Session = SessionLocal()
    try:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0
    finally:
        db.close()


def test_ia_rechaza_clases_duplicadas_en_propuesta():
    """9. La IA devuelve dos clases con el mismo nombre en la misma propuesta: se rechaza."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Duplicados")

    mock_duplicates = {
        "classes": [
            {"nombre": "Usuario", "atributos": [], "metodos": []},
            {"nombre": "Usuario", "atributos": [], "metodos": []},
        ],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_duplicates))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea usuarios."},
    )
    assert res.status_code == 400
    assert "duplicad" in res.json()["detail"].lower()

    db: Session = SessionLocal()
    try:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0
    finally:
        db.close()


def test_ia_rechaza_clase_que_ya_existe_en_diagrama():
    """10. Si la propuesta intenta volver a crear una clase ya existente en el diagrama, se rechaza."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Existente Previamente")

    # Crear manualmente la clase 'Producto' en el diagrama
    res_c = client.post(
        f"/api/diagramas/{diag_id}/clases",
        headers=headers,
        json={"nombre": "Producto", "estereotipo": "«entity»", "posicion_x": 100, "posicion_y": 100},
    )
    assert res_c.status_code == 201

    # La IA propone crear 'Producto' otra vez
    mock_repeat = {
        "classes": [{"nombre": "Producto", "atributos": [], "metodos": []}],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_repeat))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea Producto."},
    )
    assert res.status_code == 400
    assert "ya existe" in res.json()["detail"].lower()


def test_ia_json_invalido_de_ia_no_modifica_diagrama():
    """11. Si la IA produce texto malformado o JSON corrupto, se retorna 422 y no se toca el diagrama."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Corrupto")

    IAService.set_mock_client(lambda prompt: "Esto no es un JSON válido { classes: incompleto...")

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea cosas."},
    )
    assert res.status_code == 422

    db: Session = SessionLocal()
    try:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0
    finally:
        db.close()


def test_ia_respuesta_vacia_rechazada():
    """12. Si la IA produce un JSON sin clases ni relaciones, se rechaza."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Vacio")

    IAService.set_mock_client(lambda prompt: json.dumps({"classes": [], "relations": []}))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Hola IA."},
    )
    assert res.status_code == 400
    assert "no propuso" in res.json()["detail"].lower()


def test_ia_fallo_durante_persistencia_provoca_rollback_completo(monkeypatch):
    """13. Si ocurre un fallo técnico antes del commit, se ejecuta rollback y no queda nada persistido."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Rollback")

    mock_proposal = {
        "classes": [
            {"nombre": "ClaseUno", "atributos": [], "metodos": []},
            {"nombre": "ClaseDos", "atributos": [], "metodos": []},
        ],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    # Forzar error simulado durante la transacción antes del commit
    original_commit = Session.commit

    def failing_commit(self):
        raise RuntimeError("Fallo simulado de base de datos antes del commit")

    monkeypatch.setattr(Session, "commit", failing_commit)

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea dos clases."},
    )
    assert res.status_code == 500

    # Restaurar commit y verificar que en la base de datos no quedó NINGUNA clase
    monkeypatch.undo()
    db: Session = SessionLocal()
    try:
        count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert count == 0, "El rollback debió limpiar todas las clases insertadas antes del commit fallido"
    finally:
        db.close()


def test_ia_emite_diagram_changed_por_websocket_tras_commit():
    """13. Una generación exitosa provoca emisión de diagram.changed a usuarios conectados."""
    token_carlos = get_token("carlos@classflow.com")
    token_ana = get_token("ana@classflow.com")
    headers_carlos = {"Authorization": f"Bearer {token_carlos}"}

    proj_id, diag_id = create_project_and_diagram(headers_carlos, "[TEST-IA] WS Sync")

    # Invitar a Ana
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_carlos,
        json={"email": "ana@classflow.com", "permiso_edicion": True},
    )

    mock_proposal = {
        "classes": [{"nombre": "Noticia", "atributos": [], "metodos": []}],
        "relations": [],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    # Ana se conecta al WebSocket del diagrama
    with client.websocket_connect(f"/api/ws/diagramas/{diag_id}?token={token_ana}") as ws_ana:
        init_ev = ws_ana.receive_json()
        assert init_ev["type"] == "session.init"

        # Carlos genera la clase 'Noticia' vía IA
        res = client.post(
            f"/api/diagramas/{diag_id}/ia/generar",
            headers=headers_carlos,
            json={"prompt": "Crea la clase Noticia."},
        )
        assert res.status_code == 200

        # Ana recibe diagram.changed por WebSocket en tiempo real
        ev_changed = ws_ana.receive_json()
        assert ev_changed["type"] == "diagram.changed"
        assert ev_changed["diagram_id"] == diag_id


def test_ia_sin_api_key_retorna_503_en_produccion():
    """14. Si no hay mock ni GEMINI_API_KEY configurada, se retorna 503 explicativo."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] No Key")

    # Asegurar que mock_client es None y GEMINI_API_KEY está vacía
    IAService.set_mock_client(None)
    from app.core.config import settings
    old_key = settings.GEMINI_API_KEY
    settings.GEMINI_API_KEY = ""

    try:
        res = client.post(
            f"/api/diagramas/{diag_id}/ia/generar",
            headers=headers,
            json={"prompt": "Crea una clase."},
        )
        assert res.status_code == 503
        assert "GEMINI_API_KEY" in res.json()["detail"]
    finally:
        settings.GEMINI_API_KEY = old_key


def test_ia_persiste_los_seis_tipos_oficiales_de_relacion():
    """15. La propuesta de IA puede persistir cada uno de los 6 tipos canónicos oficiales."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] 6 Tipos Relaciones")

    mock_proposal = {
        "classes": [
            {"nombre": "Base", "atributos": [], "metodos": []},
            {"nombre": "Derivada", "atributos": [], "metodos": []},
            {"nombre": "Contenedor", "atributos": [], "metodos": []},
            {"nombre": "Parte", "atributos": [], "metodos": []},
            {"nombre": "Servicio", "atributos": [], "metodos": []},
            {"nombre": "ClienteServ", "atributos": [], "metodos": []},
            {"nombre": "Interfaz", "atributos": [], "metodos": []},
            {"nombre": "Implementa", "atributos": [], "metodos": []},
        ],
        "relations": [
            {"origen": "Derivada", "destino": "Base", "tipo": "herencia"},
            {"origen": "Contenedor", "destino": "Parte", "tipo": "composicion"},
            {"origen": "Contenedor", "destino": "Base", "tipo": "agregacion"},
            {"origen": "ClienteServ", "destino": "Servicio", "tipo": "dependencia"},
            {"origen": "Implementa", "destino": "Interfaz", "tipo": "realizacion"},
            {"origen": "Base", "destino": "Servicio", "tipo": "asociacion"},
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea modelos con los 6 tipos de relaciones."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["created_relations"] == 6

    db: Session = SessionLocal()
    try:
        rels = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).all()
        tipos_en_db = {r.tipo for r in rels}
        assert tipos_en_db == {
            "herencia",
            "composicion",
            "agregacion",
            "dependencia",
            "realizacion",
            "asociacion",
        }
    finally:
        db.close()


def test_ia_retry_exitoso_tras_503_transitorio(monkeypatch):
    """16. Gemini responde 503 en intento 1 y 200 en intento 2: reintenta con backoff y aplica una sola vez."""
    from app.core.config import settings
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Retry 503 Exito")

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-gemini-key")
    IAService.set_mock_client(None)

    call_count = 0
    mock_proposal = {
        "classes": [{"nombre": "ItemRetry", "atributos": [], "metodos": []}],
        "relations": [],
    }

    def transport_handler(url: str, payload: dict) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(
                status_code=503,
                json={"error": {"code": 503, "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."}}
            )
        # Intento 2: Éxito 200
        gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": json.dumps(mock_proposal)}
                        ]
                    }
                }
            ]
        }
        return httpx.Response(status_code=200, json=gemini_response)

    # backoff_factor=0.0 para que el test no espere segundos
    IAService.set_mock_transport(transport_handler, backoff_factor=0.0)

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea la clase ItemRetry."},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "ItemRetry" in data["created_classes"]
    assert call_count == 2, f"Se esperaban 2 llamadas (1 fallo 503 + 1 reintento exitoso), pero hubo {call_count}"

    # Verificar que en PostgreSQL se aplicó exactamente una vez
    db: Session = SessionLocal()
    try:
        items = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "ItemRetry").all()
        assert len(items) == 1
    finally:
        db.close()


def test_ia_agota_reintentos_ante_503_persistente(monkeypatch):
    """17. Gemini responde 503 en todos los intentos: se agotan reintentos (3), error controlado y DB intacta."""
    from app.core.config import settings
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] 503 Persistente")

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-gemini-key")
    IAService.set_mock_client(None)

    call_count = 0

    def transport_handler(url: str, payload: dict) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            status_code=503,
            json={"error": {"code": 503, "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."}}
        )

    IAService.set_mock_transport(transport_handler, backoff_factor=0.0)

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea una clase con alta demanda."},
    )
    assert res.status_code == 503
    assert "alta demanda" in res.json()["detail"].lower() or "temporalmente" in res.json()["detail"].lower()
    assert call_count == 3, f"Se esperaban exactamente 3 llamadas por MAX_RETRIES=3, pero hubo {call_count}"

    # Verificar que PostgreSQL no sufrió ninguna modificación
    db: Session = SessionLocal()
    try:
        count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert count == 0
    finally:
        db.close()


def test_ia_no_reintenta_error_permanente_404(monkeypatch):
    """18. Gemini responde 404 (modelo inexistente/no disponible): aborta en intento 1 sin reintentos innecesarios."""
    from app.core.config import settings
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] 404 No Retry")

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-gemini-key")
    IAService.set_mock_client(None)

    call_count = 0

    def transport_handler(url: str, payload: dict) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            status_code=404,
            json={"error": {"code": 404, "message": "models/gemini-2.0-flash is not found for API version v1beta"}}
        )

    IAService.set_mock_transport(transport_handler, backoff_factor=0.0)

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea una clase con modelo inexistente."},
    )
    assert res.status_code == 502
    assert "404" in res.json()["detail"]
    assert call_count == 1, f"Un error 404 permanente no debe reintentarse (esperado 1 llamada, hubo {call_count})"

    # Verificar que PostgreSQL no sufrió ninguna modificación
    db: Session = SessionLocal()
    try:
        count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert count == 0
    finally:
        db.close()


# =============================================================================
# PRUEBAS DE MANEJO DE CLASES EXISTENTES Y RELACIONES (CORRECCIÓN FASE 6)
# =============================================================================

def test_ia_relacion_entre_clases_existentes_classes_vacio():
    """A. Cliente y ProveedorIA ya existen; Gemini devuelve classes: [] y una relacion: crea solo la relacion."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Rel Classes Vacio")

    # Crear Cliente y ProveedorIA
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente", "posicion_x": 100, "posicion_y": 100})
    assert res_c.status_code == 201
    res_p = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "ProveedorIA", "posicion_x": 400, "posicion_y": 100})
    assert res_p.status_code == 201

    mock_proposal = {
        "classes": [],
        "relations": [
            {
                "origen": "Cliente",
                "destino": "ProveedorIA",
                "tipo": "asociacion",
                "nombre": "contrata",
                "multiplicidad_origen": "1",
                "multiplicidad_destino": "0..*",
            }
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea una relación entre Cliente y ProveedorIA."},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert len(data["created_classes"]) == 0
    assert data["created_relations"] == 1
    assert data["total_classes"] == 2
    assert data["total_relations"] == 1

    # Verificar en PostgreSQL
    db: Session = SessionLocal()
    try:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 2
        rel = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).first()
        assert rel is not None
        assert rel.tipo == "asociacion"
        assert rel.nombre == "contrata"
    finally:
        db.close()


def test_ia_relacion_entre_clases_existentes_incluidas_como_referencias_en_classes():
    """B. Cliente y ProveedorIA existen; Gemini devuelve ambas clases como referencias sin cambios en classes: evita duplicarlas y crea solo la relacion."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Rel Referencias Echo")

    # Crear Cliente y ProveedorIA
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente", "posicion_x": 100, "posicion_y": 100})
    assert res_c.status_code == 201
    id_c = res_c.json()["id_clase"]
    res_p = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "ProveedorIA", "posicion_x": 400, "posicion_y": 100})
    assert res_p.status_code == 201
    id_p = res_p.json()["id_clase"]

    mock_proposal = {
        "classes": [
            {"nombre": "Cliente", "atributos": [], "metodos": []},
            {"nombre": "ProveedorIA", "atributos": [], "metodos": []},
        ],
        "relations": [
            {
                "origen": "Cliente",
                "destino": "ProveedorIA",
                "tipo": "asociacion",
                "multiplicidad_origen": "1",
                "multiplicidad_destino": "*",
            }
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea una asociación 1 a muchos entre Cliente y ProveedorIA."},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["created_classes"]) == 0
    assert data["created_relations"] == 1
    assert data["total_classes"] == 2

    # Verificar que los id_clase originales son exactamente los mismos (no se recrearon)
    db: Session = SessionLocal()
    try:
        clases = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).all()
        assert len(clases) == 2
        ids_actuales = {c.id_clase for c in clases}
        assert ids_actuales == {id_c, id_p}
        rel = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).first()
        assert rel is not None
        assert rel.id_clase_origen == id_c
        assert rel.id_clase_destino == id_p
    finally:
        db.close()


def test_ia_no_sobrescribe_ni_pierde_atributos_metodos_de_clase_existente():
    """C. Una clase existente con atributos y métodos no sufre modificaciones silenciosas ni pérdida de datos al crear una relación."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Integridad Existente")

    # Crear Cliente con atributo y método
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Cliente", "posicion_x": 100, "posicion_y": 100})
    assert res_c.status_code == 201
    id_c = res_c.json()["id_clase"]

    res_a = client.post(f"/api/clases/{id_c}/atributos", headers=headers, json={"nombre": "correo", "tipo_dato": "String", "visibilidad": "private"})
    assert res_a.status_code == 201

    res_m = client.post(f"/api/clases/{id_c}/metodos", headers=headers, json={"nombre": "obtenerCorreo", "tipo_retorno": "String", "visibilidad": "public"})
    assert res_m.status_code == 201

    # Crear Servidor
    res_s = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Servidor", "posicion_x": 500, "posicion_y": 100})
    assert res_s.status_code == 201

    # Gemini devuelve Cliente y Servidor sin atributos, y una relación
    mock_proposal = {
        "classes": [
            {"nombre": "Cliente", "atributos": [], "metodos": []},
            {"nombre": "Servidor", "atributos": [], "metodos": []},
        ],
        "relations": [
            {"origen": "Cliente", "destino": "Servidor", "tipo": "dependencia"}
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Cliente depende de Servidor."},
    )
    assert res.status_code == 200

    # Verificar que Cliente sigue teniendo exactamente su atributo 'correo' y su método 'obtenerCorreo'
    db: Session = SessionLocal()
    try:
        cliente_db = db.query(ClaseUML).filter(ClaseUML.id_clase == id_c).first()
        assert cliente_db is not None
        assert len(cliente_db.atributos) == 1
        assert cliente_db.atributos[0].nombre == "correo"
        assert len(cliente_db.metodos) == 1
        assert cliente_db.metodos[0].nombre == "obtenerCorreo"
    finally:
        db.close()


def test_ia_rechaza_colision_incompatible_de_clase_existente():
    """D. Si Gemini propone miembros nuevos o incompatibles para una clase existente, se rechaza."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Colision Incompatible")

    # Crear Factura solo con id
    res_f = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Factura", "posicion_x": 100, "posicion_y": 100})
    assert res_f.status_code == 201
    id_f = res_f.json()["id_clase"]
    res_a = client.post(f"/api/clases/{id_f}/atributos", headers=headers, json={"nombre": "id", "tipo_dato": "Long"})
    assert res_a.status_code == 201

    # Crear Pago
    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Pago", "posicion_x": 400, "posicion_y": 100})

    # Gemini intenta modificar Factura añadiendo un atributo nuevo 'numeroFiscalIncompatible'
    mock_proposal = {
        "classes": [
            {
                "nombre": "Factura",
                "atributos": [{"nombre": "numeroFiscalIncompatible", "tipo_dato": "String"}],
                "metodos": [],
            },
            {"nombre": "Pago", "atributos": [], "metodos": []},
        ],
        "relations": [
            {"origen": "Factura", "destino": "Pago", "tipo": "asociacion"}
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Relaciona Factura y Pago modificando Factura."},
    )
    assert res.status_code == 400
    assert "incompatibles" in res.json()["detail"].lower() or "modificar clases" in res.json()["detail"].lower()

    # Comprobar que en DB Factura no adquirió el atributo incompatible y no se creó la relación
    db: Session = SessionLocal()
    try:
        factura_db = db.query(ClaseUML).filter(ClaseUML.id_clase == id_f).first()
        assert len(factura_db.atributos) == 1
        assert factura_db.atributos[0].nombre == "id"
        assert db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).count() == 0
    finally:
        db.close()


def test_ia_rechaza_relacion_a_clase_que_realmente_no_existe():
    """E. Relación hacia una clase inexistente en diagrama y propuesta sigue siendo rechazada."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Target Realmente Fantasma")

    # Crear solo OrigenReal
    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "OrigenReal", "posicion_x": 100, "posicion_y": 100})

    mock_proposal = {
        "classes": [],
        "relations": [
            {"origen": "OrigenReal", "destino": "DestinoInexistente", "tipo": "asociacion"}
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Relaciona OrigenReal con DestinoInexistente."},
    )
    assert res.status_code == 400
    assert "no existe" in res.json()["detail"].lower()

    # No se creó ninguna relación
    db: Session = SessionLocal()
    try:
        assert db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).count() == 0
    finally:
        db.close()


def test_ia_sin_persistencia_parcial_ante_error_en_propuesta_mixta():
    """F. Ningún error en la propuesta deja persistencia parcial en base de datos."""
    token_carlos = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token_carlos}"}
    _, diag_id = create_project_and_diagram(headers, "[TEST-IA] Sin Persistencia Parcial")

    # Propuesta con 1 clase nueva válida, pero una relación a un destino inexistente
    mock_proposal = {
        "classes": [
            {"nombre": "NuevaValida", "atributos": [], "metodos": []}
        ],
        "relations": [
            {"origen": "NuevaValida", "destino": "InexistenteTotal", "tipo": "asociacion"}
        ],
    }
    IAService.set_mock_client(lambda prompt: json.dumps(mock_proposal))

    res = client.post(
        f"/api/diagramas/{diag_id}/ia/generar",
        headers=headers,
        json={"prompt": "Crea NuevaValida y relaciónala con InexistenteTotal."},
    )
    assert res.status_code == 400

    # Verificar que NuevaValida NO quedó en PostgreSQL
    db: Session = SessionLocal()
    try:
        count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert count == 0
    finally:
        db.close()


