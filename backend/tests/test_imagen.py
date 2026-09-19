import io
import json
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, RelacionUML

client = TestClient(app)


# =============================================================================
# HELPERS
# =============================================================================
def get_token(email: str, password: str = "ClassFlow2026!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-CU07] Proyecto Imagen") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc"})
    assert res_p.status_code == 201
    proj_id = res_p.json()["id_proyecto"]

    res_d = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res_d.status_code == 200
    diag_id = res_d.json()["id_diagrama"]
    return proj_id, diag_id


MOCK_GEMINI_UML_RESPONSE = json.dumps({
    "classes": [
        {
            "nombre": "Estudiante",
            "estereotipo": "«entity»",
            "visibilidad": "public",
            "es_abstracta": False,
            "atributos": [
                {
                    "nombre": "matricula",
                    "tipo_dato": "String",
                    "visibilidad": "private",
                    "valor_defecto": None,
                    "es_estatico": False,
                    "es_final": False,
                    "es_nullable": False,
                },
                {
                    "nombre": "nombreCompleto",
                    "tipo_dato": "String",
                    "visibilidad": "private",
                    "valor_defecto": None,
                    "es_estatico": False,
                    "es_final": False,
                    "es_nullable": True,
                },
            ],
            "metodos": [
                {
                    "nombre": "inscribirMateria",
                    "tipo_retorno": "void",
                    "visibilidad": "public",
                    "es_estatico": False,
                    "es_abstracto": False,
                    "parametros": [
                        {
                            "nombre": "codigoMateria",
                            "tipo_dato": "String",
                            "valor_defecto": None,
                        }
                    ],
                }
            ],
        },
        {
            "nombre": "Carrera",
            "estereotipo": "«entity»",
            "visibilidad": "public",
            "es_abstracta": False,
            "atributos": [
                {
                    "nombre": "codigo",
                    "tipo_dato": "String",
                    "visibilidad": "private",
                    "valor_defecto": None,
                    "es_estatico": False,
                    "es_final": False,
                    "es_nullable": False,
                }
            ],
            "metodos": [],
        },
    ],
    "relations": [
        {
            "origen": "Estudiante",
            "destino": "Carrera",
            "tipo": "asociacion",
            "nombre": "perteneceA",
            "multiplicidad_origen": "*",
            "multiplicidad_destino": "1",
            "rol_origen": None,
            "rol_destino": None,
            "navegabilidad_origen": False,
            "navegabilidad_destino": True,
        }
    ],
})


# =============================================================================
# PRUEBAS DE FASE 8 — CU07 IMPORTAR DIAGRAMA DESDE IMAGEN
# =============================================================================

def test_1_propietario_analizar_imagen_valida_no_persiste():
    """1. Propietario analiza imagen válida: Gemini devuelve propuesta estructurada pero NO modifica la BD."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Propietario Analizar")

    image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    files = {"file": ("pizarra_uml.png", io.BytesIO(image_content), "image/png")}

    with patch("app.services.image_service.ImageService._call_gemini_multimodal", return_value=MOCK_GEMINI_UML_RESPONSE):
        res = client.post(f"/api/diagramas/{diag_id}/imagen/analizar", headers=headers, files=files)

    assert res.status_code == 200
    data = res.json()
    assert len(data["classes"]) == 2
    assert data["classes"][0]["nombre"] == "Estudiante"
    assert len(data["classes"][0]["atributos"]) == 2
    assert len(data["classes"][0]["metodos"]) == 1
    assert data["classes"][1]["nombre"] == "Carrera"
    assert len(data["relations"]) == 1
    assert data["relations"][0]["tipo"] == "asociacion"

    # Verificar que la base de datos NO fue modificada en esta fase de análisis
    with SessionLocal() as db:
        clases_en_db = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count()
        assert clases_en_db == 0


def test_2_invitado_analizar_imagen_recibe_403():
    """2. Desarrollador invitado (incluso con permiso_edicion=True) recibe 403 al intentar analizar imagen."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_l = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU07] Invitado 403 Analizar")
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_c,
        json={"email": "luis@classflow.com", "permiso_edicion": True},
    )

    image_content = b"\x89PNG\r\n\x1a\nfake"
    files = {"file": ("diagrama.png", io.BytesIO(image_content), "image/png")}

    res = client.post(f"/api/diagramas/{diag_id}/imagen/analizar", headers=headers_l, files=files)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_3_invitado_aplicar_propuesta_recibe_403():
    """3. Desarrollador invitado recibe 403 al intentar aplicar propuesta de imagen."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_l = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU07] Invitado 403 Aplicar")
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_c,
        json={"email": "luis@classflow.com", "permiso_edicion": True},
    )

    proposal = json.loads(MOCK_GEMINI_UML_RESPONSE)
    res = client.post(f"/api/diagramas/{diag_id}/imagen/aplicar", headers=headers_l, json=proposal)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_4_formato_invalido_es_rechazado():
    """4. Archivo con extensión o MIME no soportado (.pdf, .txt) es rechazado con 400 Bad Request."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Formato Inválido")

    files = {"file": ("documento.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
    res = client.post(f"/api/diagramas/{diag_id}/imagen/analizar", headers=headers, files=files)
    assert res.status_code == 400
    assert "no soportado" in res.json()["detail"].lower()


def test_5_archivo_vacio_es_rechazado():
    """5. Archivo vacío (0 bytes) es rechazado con 400 Bad Request."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Archivo Vacío")

    files = {"file": ("vacio.png", io.BytesIO(b""), "image/png")}
    res = client.post(f"/api/diagramas/{diag_id}/imagen/analizar", headers=headers, files=files)
    assert res.status_code == 400
    assert "vacío" in res.json()["detail"].lower()


def test_6_cancelar_no_modifica_base_de_datos():
    """6. Cuando el usuario analiza y cancela (sin llamar a aplicar), PostgreSQL y el canvas permanecen intactos."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Flujo Cancelar")

    image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("diagrama.png", io.BytesIO(image_content), "image/png")}

    with patch("app.services.image_service.ImageService._call_gemini_multimodal", return_value=MOCK_GEMINI_UML_RESPONSE):
        res = client.post(f"/api/diagramas/{diag_id}/imagen/analizar", headers=headers, files=files)
    assert res.status_code == 200

    # Simular cancelación en frontend (no se invoca endpoint de aplicar)
    with SessionLocal() as db:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0
        assert db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).count() == 0


def test_7_aplicar_propuesta_valida_persiste_elementos_completos():
    """7. Propietario aplica propuesta válida: clases, atributos, métodos y relaciones se persisten atómicamente."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Aplicar Válido")

    proposal = json.loads(MOCK_GEMINI_UML_RESPONSE)

    with patch("app.services.diagrama_service.DiagramaService._notify_diagram_changed") as mock_notify:
        res = client.post(f"/api/diagramas/{diag_id}/imagen/aplicar", headers=headers, json=proposal)
        assert res.status_code == 200
        mock_notify.assert_called_once()

    data = res.json()
    assert data["success"] is True
    assert data["created_classes"] == ["Estudiante", "Carrera"]
    assert data["created_relations"] == 1
    assert data["total_classes"] == 2
    assert data["total_relations"] == 1

    # Verificación en base de datos
    with SessionLocal() as db:
        estudiante = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Estudiante").first()
        assert estudiante is not None
        assert len(estudiante.atributos) == 2
        assert len(estudiante.metodos) == 1
        assert estudiante.metodos[0].nombre == "inscribirMateria"
        assert len(estudiante.metodos[0].parametros) == 1
        assert estudiante.metodos[0].parametros[0].nombre == "codigoMateria"

        carrera = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Carrera").first()
        assert carrera is not None
        assert len(carrera.atributos) == 1

        relacion = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_id).first()
        assert relacion is not None
        assert relacion.tipo == "asociacion"
        assert relacion.multiplicidad_origen == "*"
        assert relacion.multiplicidad_destino == "1"


def test_8_propuesta_con_relacion_hacia_clase_inexistente_falla_con_rollback():
    """8. Propuesta con relación a clase inexistente es rechazada (400) y no persiste nada (rollback)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Rollback Relacion Invalida")

    proposal = {
        "classes": [
            {
                "nombre": "Orden",
                "atributos": [{"nombre": "total", "tipo_dato": "Double"}],
                "metodos": [],
            }
        ],
        "relations": [
            {
                "origen": "Orden",
                "destino": "UsuarioFantasma",  # NO EXISTE
                "tipo": "asociacion",
                "multiplicidad_origen": "1",
                "multiplicidad_destino": "1",
            }
        ],
    }

    res = client.post(f"/api/diagramas/{diag_id}/imagen/aplicar", headers=headers, json=proposal)
    assert res.status_code == 400
    assert "usuariofantasma" in res.json()["detail"].lower()

    # Comprobar rollback total (Orden tampoco debió guardarse)
    with SessionLocal() as db:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0


def test_9_propuesta_vacia_es_rechazada():
    """9. Propuesta sin clases ni relaciones es rechazada con 400 Bad Request."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU07] Propuesta Vacía")

    proposal = {"classes": [], "relations": []}
    res = client.post(f"/api/diagramas/{diag_id}/imagen/aplicar", headers=headers, json=proposal)
    assert res.status_code == 400
    assert "no contiene elementos" in res.json()["detail"].lower()
