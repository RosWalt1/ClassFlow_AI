import pytest
import json
from datetime import datetime
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.database.session import SessionLocal
from app.models.usuario import Usuario
from app.models.proyecto import Proyecto, ProyectoColaborador
from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML
from app.models.sesion import SesionColaborativa, SesionParticipante
from app.core.ws_manager import ws_manager

client = TestClient(app)


@pytest.fixture(scope="module")
def tokens():
    """Autentica a los usuarios de prueba y retorna sus tokens JWT."""
    res_carlos = client.post(
        "/api/auth/login",
        json={"email": "carlos@classflow.com", "password": "ClassFlow2026!"},
    )
    assert res_carlos.status_code == 200, f"Login carlos falló: {res_carlos.text}"
    token_carlos = res_carlos.json()["access_token"]
    user_carlos = res_carlos.json()["user"]

    res_ana = client.post(
        "/api/auth/login",
        json={"email": "ana@classflow.com", "password": "ClassFlow2026!"},
    )
    assert res_ana.status_code == 200, f"Login ana falló: {res_ana.text}"
    token_ana = res_ana.json()["access_token"]
    user_ana = res_ana.json()["user"]

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


@pytest.fixture(scope="module")
def setup_colaboracion(tokens):
    """
    Crea dos proyectos de prueba:
    - Proyecto A: Carlos (Owner), Ana (Colaboradora editora)
    - Proyecto B: Carlos (Owner), Luis (Colaborador solo lectura)
    """
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}

    # 1. Proyecto A
    res_pa = client.post(
        "/api/proyectos",
        json={
            "nombre": "[TEST-CU04] Proyecto Colab A",
            "descripcion": "Sala colaborativa A",
        },
        headers=headers_carlos,
    )
    assert res_pa.status_code == 201, f"Error creando Proyecto A: {res_pa.text}"
    p_a_id = res_pa.json()["id_proyecto"]

    res_diag_a = client.get(f"/api/proyectos/{p_a_id}/diagrama", headers=headers_carlos)
    assert res_diag_a.status_code == 200
    diag_a_id = res_diag_a.json()["id_diagrama"]

    # Invitar a Ana con permiso_edicion=True
    res_add_ana = client.post(
        f"/api/proyectos/{p_a_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )
    assert res_add_ana.status_code == 201

    # 2. Proyecto B
    res_pb = client.post(
        "/api/proyectos",
        json={
            "nombre": "[TEST-CU04] Proyecto Colab B",
            "descripcion": "Sala colaborativa B",
        },
        headers=headers_carlos,
    )
    assert res_pb.status_code == 201, f"Error creando Proyecto B: {res_pb.text}"
    p_b_id = res_pb.json()["id_proyecto"]

    res_diag_b = client.get(f"/api/proyectos/{p_b_id}/diagrama", headers=headers_carlos)
    assert res_diag_b.status_code == 200
    diag_b_id = res_diag_b.json()["id_diagrama"]

    # Invitar a Luis como Lector (permiso_edicion=False)
    res_add_luis = client.post(
        f"/api/proyectos/{p_b_id}/colaboradores",
        json={"email": "luis@classflow.com", "permiso_edicion": False},
        headers=headers_carlos,
    )
    assert res_add_luis.status_code == 201

    return {
        "p_a_id": p_a_id,
        "diag_a_id": diag_a_id,
        "p_b_id": p_b_id,
        "diag_b_id": diag_b_id,
    }


# ==============================================================================
# 1 & 2. CONEXIÓN PROPIETARIO Y COLABORADOR ACTIVO
# ==============================================================================

def test_propietario_conecta(tokens, setup_colaboracion):
    """Propietario se conecta y recibe session.init con código y datos."""
    diag_a = setup_colaboracion["diag_a_id"]
    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['carlos']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "session.init"
        assert msg["diagram_id"] == diag_a
        assert msg["session_code"].startswith("CF-")
        assert msg["user"]["email"] == "carlos@classflow.com"
        assert msg["user"]["es_propietario"] is True
        assert msg["user"]["permiso_edicion"] is True


def test_colaborador_activo_conecta(tokens, setup_colaboracion):
    """Colaborador activo con edición se conecta exitosamente."""
    diag_a = setup_colaboracion["diag_a_id"]
    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "session.init"
        assert msg["diagram_id"] == diag_a
        assert msg["user"]["email"] == "ana@classflow.com"
        assert msg["user"]["es_propietario"] is False
        assert msg["user"]["permiso_edicion"] is True


# ==============================================================================
# 3 & 4. RECHAZO DE USUARIOS NO AUTORIZADOS O REVOCADOS
# ==============================================================================

def test_usuario_ajeno_no_conecta(tokens, setup_colaboracion):
    """Usuario ajeno (Luis en Proyecto A) es rechazado con código 1008."""
    diag_a = setup_colaboracion["diag_a_id"]
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['luis']}") as ws:
            pass
    assert exc.value.code == 1008


def test_colaborador_revocado_no_conecta(tokens, setup_colaboracion):
    """Colaborador revocado en el proyecto es rechazado con código 1008."""
    diag_b = setup_colaboracion["diag_b_id"]
    p_b_id = setup_colaboracion["p_b_id"]
    headers_c = {"Authorization": f"Bearer {tokens['carlos']}"}

    # Obtener ID del colaborador Luis en Proyecto B y revocarlo
    res_list = client.get(f"/api/proyectos/{p_b_id}/colaboradores", headers=headers_c)
    colab_luis = next(c for c in res_list.json() if c["email"] == "luis@classflow.com")
    colab_id = colab_luis["id_colaborador"]

    res_rev = client.delete(f"/api/proyectos/{p_b_id}/colaboradores/{colab_id}", headers=headers_c)
    assert res_rev.status_code == 200

    # Ahora Luis intenta conectar por WebSocket al Diagrama B -> debe ser rechazado
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/diagramas/{diag_b}?token={tokens['luis']}") as ws:
            pass
    assert exc.value.code == 1008

    # Restaurar a Luis como lector para pruebas siguientes
    res_readd = client.post(
        f"/api/proyectos/{p_b_id}/colaboradores",
        json={"email": "luis@classflow.com", "permiso_edicion": False},
        headers=headers_c,
    )
    assert res_readd.status_code == 201


# ==============================================================================
# 5 & 6. COLABORADOR SOLO LECTURA
# ==============================================================================

def test_colaborador_solo_lectura_conecta(tokens, setup_colaboracion):
    """Colaborador solo lectura se conecta y recibe permiso_edicion=False."""
    diag_b = setup_colaboracion["diag_b_id"]
    with client.websocket_connect(f"/api/ws/diagramas/{diag_b}?token={tokens['luis']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "session.init"
        assert msg["user"]["permiso_edicion"] is False


def test_solo_lectura_no_puede_modificar_rest(tokens, setup_colaboracion):
    """Colaborador solo lectura recibe HTTP 403 al intentar crear una clase vía REST."""
    diag_b = setup_colaboracion["diag_b_id"]
    res = client.post(
        f"/api/diagramas/{diag_b}/clases",
        json={"nombre": "IntentoLectura", "pos_x": 100.0, "pos_y": 100.0},
        headers={"Authorization": f"Bearer {tokens['luis']}"},
    )
    assert res.status_code == 403
    assert "permiso de edición" in res.json()["detail"].lower()


# ==============================================================================
# 7. DOS CLIENTES CONECTADOS AL MISMO DIAGRAMA
# ==============================================================================

def test_dos_clientes_conectados_al_mismo_diagrama(tokens, setup_colaboracion):
    """Carlos y Ana pueden estar simultáneamente conectados al Diagrama A."""
    diag_a = setup_colaboracion["diag_a_id"]
    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['carlos']}") as ws_c:
        _ = ws_c.receive_json()
        with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws_a:
            _ = ws_a.receive_json()
            participants = ws_manager.get_active_participants(diag_a)
            user_ids = [p["id_usuario"] for p in participants]
            assert tokens["carlos_user"]["id_usuario"] in user_ids
            assert tokens["ana_user"]["id_usuario"] in user_ids


# ==============================================================================
# 8. MUTACIÓN REST EXITOSA -> diagram.changed -> ACTUALIZACIÓN REST
# ==============================================================================

def test_mutacion_rest_exitosa_provoca_diagram_changed(tokens, setup_colaboracion):
    """
    Flujo CU04:
    Carlos modifica UML vía REST -> PostgreSQL COMMIT -> WebSocket emite diagram.changed ->
    Ana recibe diagram.changed -> Ana consulta REST y obtiene la clase persistida.
    """
    diag_a = setup_colaboracion["diag_a_id"]

    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws_ana:
        _ = ws_ana.receive_json()  # session.init

        # Carlos crea una clase por REST
        res_post = client.post(
            f"/api/diagramas/{diag_a}/clases",
            json={"nombre": "FacturaVenta", "pos_x": 120.0, "pos_y": 220.0},
            headers={"Authorization": f"Bearer {tokens['carlos']}"},
        )
        assert res_post.status_code == 201
        clase_id = res_post.json()["id_clase"]

        # Ana recibe diagram.changed por WebSocket
        event = ws_ana.receive_json()
        assert event["type"] == "diagram.changed"
        assert event["diagram_id"] == diag_a

        # Ana obtiene el diagrama completo desde REST y verifica la clase
        res_get = client.get(
            f"/api/diagramas/{diag_a}",
            headers={"Authorization": f"Bearer {tokens['ana']}"},
        )
        assert res_get.status_code == 200
        diag_data = res_get.json()
        nombres = [c["nombre"] for c in diag_data["clases"]]
        assert "FacturaVenta" in nombres


# ==============================================================================
# 9. MUTACIÓN REST FALLIDA NO PRODUCE diagram.changed
# ==============================================================================

def test_mutacion_rest_fallida_no_produce_diagram_changed(tokens, setup_colaboracion):
    """Si una operación REST falla en PostgreSQL, jamás se emite diagram.changed."""
    diag_a = setup_colaboracion["diag_a_id"]

    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws_ana:
        _ = ws_ana.receive_json()  # session.init

        # Intentar crear una clase con nombre vacío (siempre produce 400 Bad Request)
        res_dup = client.post(
            f"/api/diagramas/{diag_a}/clases",
            json={"nombre": "   ", "pos_x": 10.0, "pos_y": 10.0},
            headers={"Authorization": f"Bearer {tokens['carlos']}"},
        )
        assert res_dup.status_code == 400

        # Enviar ping: la respuesta inmediata es pong, comprobando que no hubo diagram.changed previo
        ws_ana.send_text(json.dumps({"type": "ping"}))
        pong = ws_ana.receive_json()
        assert pong["type"] == "pong"


# ==============================================================================
# 10. AISLAMIENTO ENTRE DIAGRAMAS
# ==============================================================================

def test_eventos_diagrama_a_no_llegan_a_diagrama_b(tokens, setup_colaboracion):
    """Mutaciones en Diagrama B no emiten eventos a clientes en Diagrama A."""
    diag_a = setup_colaboracion["diag_a_id"]
    diag_b = setup_colaboracion["diag_b_id"]

    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws_a:
        _ = ws_a.receive_json()  # session.init

        with client.websocket_connect(f"/api/ws/diagramas/{diag_b}?token={tokens['luis']}") as ws_b:
            _ = ws_b.receive_json()  # session.init

            # Carlos muta Diagrama B
            res_b = client.post(
                f"/api/diagramas/{diag_b}/clases",
                json={"nombre": "ProductoStock", "pos_x": 40.0, "pos_y": 40.0},
                headers={"Authorization": f"Bearer {tokens['carlos']}"},
            )
            assert res_b.status_code == 201

            # Luis en Diagrama B recibe diagram.changed
            ev_b = ws_b.receive_json()
            assert ev_b["type"] == "diagram.changed"
            assert ev_b["diagram_id"] == diag_b

            # Ana en Diagrama A no recibió nada de Diagrama B (su siguiente mensaje al ping es pong)
            ws_a.send_text(json.dumps({"type": "ping"}))
            res_a = ws_a.receive_json()
            assert res_a["type"] == "pong"


# ==============================================================================
# 11. PRESENCIA JOIN Y LEAVE
# ==============================================================================

def test_presencia_join_y_leave(tokens, setup_colaboracion):
    """Verifica eventos presence.join y presence.leave ante conexión y desconexión."""
    diag_a = setup_colaboracion["diag_a_id"]
    carlos_id = tokens["carlos_user"]["id_usuario"]

    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws_ana:
        _ = ws_ana.receive_json()  # init ana

        # Carlos entra
        with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['carlos']}") as ws_c:
            _ = ws_c.receive_json()  # init carlos

            # Ana recibe presence.join
            join_ev = ws_ana.receive_json()
            assert join_ev["type"] == "presence.join"
            assert join_ev["user"]["id_usuario"] == carlos_id

        # Carlos sale al cerrar su bloque `with` -> Ana recibe presence.leave
        leave_ev = ws_ana.receive_json()
        assert leave_ev["type"] == "presence.leave"
        assert leave_ev["user_id"] == carlos_id


# ==============================================================================
# 12. RECONEXIÓN RECUPERA ESTADO DESDE REST
# ==============================================================================

def test_reconexion_recupera_estado_desde_rest(tokens, setup_colaboracion):
    """Tras desconexión y reconexión, el cliente consulta REST y recupera el estado íntegro."""
    diag_a = setup_colaboracion["diag_a_id"]
    ana_id = tokens["ana_user"]["id_usuario"]

    # Ana conecta y se desconecta
    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws:
        _ = ws.receive_json()
    assert ws_manager.is_user_connected(diag_a, ana_id) is False

    # Ana reconecta
    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['ana']}") as ws2:
        init_msg = ws2.receive_json()
        assert init_msg["type"] == "session.init"

        # Recuperar estado vía REST
        res_diag = client.get(
            f"/api/diagramas/{diag_a}",
            headers={"Authorization": f"Bearer {tokens['ana']}"},
        )
        assert res_diag.status_code == 200
        assert len(res_diag.json()["clases"]) >= 1


# ==============================================================================
# 13. WEBSOCKET NO PERMITE MODIFICAR UML DIRECTAMENTE
# ==============================================================================

def test_websocket_no_permite_modificar_uml_directamente(tokens, setup_colaboracion):
    """Mensajes de mutación UML enviados por WebSocket son rechazados y no modifican PostgreSQL."""
    diag_a = setup_colaboracion["diag_a_id"]

    with client.websocket_connect(f"/api/ws/diagramas/{diag_a}?token={tokens['carlos']}") as ws:
        _ = ws.receive_json()  # init

        # Intento de enviar class.deleted por WebSocket
        ws.send_text(json.dumps({"type": "class.deleted", "id_clase": 999999}))
        resp = ws.receive_json()
        assert resp["type"] == "error"
        assert "exclusivamente mediante la api rest" in resp["detail"].lower()
