import io
import xml.etree.ElementTree as ET
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML

client = TestClient(app)


# =============================================================================
# HELPERS
# =============================================================================
def get_token(email: str, password: str = "ClassFlow2026!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-CU08-09] Proyecto XMI") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc"})
    assert res_p.status_code == 201
    proj_id = res_p.json()["id_proyecto"]

    res_d = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res_d.status_code == 200
    diag_id = res_d.json()["id_diagrama"]
    return proj_id, diag_id


SAMPLE_XMI_CONTENT = """<?xml version="1.0" encoding="utf-8"?>
<xmi:XMI xmi:version="2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
  <uml:Model xmi:type="uml:Model" xmi:id="model_1" name="ModeloPrueba">
    <packagedElement xmi:type="uml:Class" xmi:id="class_1" name="Factura" visibility="public" isAbstract="false" stereotype="«entity»">
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_1" name="numero" visibility="private" isStatic="false" isReadOnly="false">
        <type xmi:type="uml:PrimitiveType" name="String" />
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_2" name="total" visibility="private" isStatic="false" isReadOnly="false">
        <type xmi:type="uml:PrimitiveType" name="Double" />
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="op_1" name="calcularImpuesto" visibility="public" isStatic="false" isAbstract="false">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="param_1" name="tasa">
          <type xmi:type="uml:PrimitiveType" name="Double" />
        </ownedParameter>
        <ownedParameter xmi:type="uml:Parameter" xmi:id="ret_1" name="return" direction="return">
          <type xmi:type="uml:PrimitiveType" name="Double" />
        </ownedParameter>
      </ownedOperation>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="class_2" name="Cliente" visibility="public" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_3" name="razonSocial" visibility="private">
        <type xmi:type="uml:PrimitiveType" name="String" />
      </ownedAttribute>
    </packagedElement>
    <packagedElement xmi:type="uml:Association" xmi:id="assoc_1" name="emite">
      <memberEnd xmi:idref="end_1" />
      <memberEnd xmi:idref="end_2" />
      <ownedEnd xmi:type="uml:Property" xmi:id="end_1" type="class_2" multiplicity="1">
        <lowerValue xmi:type="uml:LiteralString" value="1" />
        <upperValue xmi:type="uml:LiteralString" value="1" />
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="end_2" type="class_1" aggregation="none" multiplicity="0..*">
        <lowerValue xmi:type="uml:LiteralString" value="0" />
        <upperValue xmi:type="uml:LiteralString" value="*" />
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>
"""


# =============================================================================
# PRUEBAS OFICIALES DE FASE 9 — CU08 Y CU09
# =============================================================================

def test_1_propietario_exporta_xmi_exitoso():
    """1. Propietario exporta correctamente a XML XMI 2.1 estándar."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU09] Exportar Propietario")

    # Crear una clase de prueba
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "Producto", "visibilidad": "public"})
    assert res_c.status_code == 201

    res = client.get(f"/api/diagramas/{diag_id}/xmi/exportar", headers=headers)
    assert res.status_code == 200
    assert "application/xml" in res.headers["content-type"]
    assert f'attachment; filename="diagrama_{diag_id}.xmi"' in res.headers["content-disposition"]

    xml_text = res.text
    assert "<xmi:XMI" in xml_text or "XMI" in xml_text
    assert "Producto" in xml_text


def test_2_invitado_exportar_xmi_recibe_403():
    """2. Desarrollador invitado recibe 403 al intentar exportar XMI."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_l = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU09] 403 Invitado")
    client.post(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_c, json={"email": "luis@classflow.com", "permiso_edicion": True})

    res = client.get(f"/api/diagramas/{diag_id}/xmi/exportar", headers=headers_l)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_3_propietario_importa_xmi_en_diagrama_vacio_exitoso():
    """3. Propietario importa archivo XMI válido en un diagrama vacío."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Importar Vacío")

    files = {"file": ("modelo.xmi", io.BytesIO(SAMPLE_XMI_CONTENT.encode("utf-8")), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_classes"] == 2
    assert data["total_relations"] == 1

    with SessionLocal() as db:
        factura = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id, ClaseUML.nombre == "Factura").first()
        assert factura is not None
        assert len(factura.atributos) == 2
        assert len(factura.metodos) == 1
        assert factura.metodos[0].nombre == "calcularImpuesto"
        assert factura.metodos[0].tipo_retorno == "Double"
        assert len(factura.metodos[0].parametros) == 1
        assert factura.metodos[0].parametros[0].nombre == "tasa"


def test_4_invitado_importar_xmi_recibe_403():
    """4. Desarrollador invitado recibe 403 al intentar importar XMI."""
    token_carlos = get_token("carlos@classflow.com")
    token_luis = get_token("luis@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_l = {"Authorization": f"Bearer {token_luis}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU08] 403 Invitado")
    client.post(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_c, json={"email": "luis@classflow.com", "permiso_edicion": True})

    files = {"file": ("modelo.xmi", io.BytesIO(SAMPLE_XMI_CONTENT.encode("utf-8")), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers_l, files=files)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_5_importar_xmi_extension_invalida_rechazada():
    """5. Extensión de archivo inválida (.pdf, .txt) es rechazada con 400."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Extensión Inválida")

    files = {"file": ("modelo.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "no permitida" in res.json()["detail"].lower()


def test_6_importar_xmi_archivo_vacio_rechazado():
    """6. Archivo vacío es rechazado con 400."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Archivo Vacío")

    files = {"file": ("vacio.xmi", io.BytesIO(b""), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "está vacío" in res.json()["detail"].lower()


def test_7_importar_xmi_xml_malformado_rechazado():
    """7. XML malformado es rechazado con 400."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Malformado")

    files = {"file": ("corrupto.xmi", io.BytesIO(b"<xmi:XMI><unclosed>"), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "malformado" in res.json()["detail"].lower()


def test_8_importar_xmi_seguridad_doctype_entity_bloqueado():
    """8. Inyección de DOCTYPE o ENTITY es bloqueada por seguridad (XXE) con 400."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] XXE")

    malicious_xml = b"""<?xml version="1.0"?>
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
    <xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
      <uml:Class name="Test">&xxe;</uml:Class>
    </xmi:XMI>
    """
    files = {"file": ("ataque.xmi", io.BytesIO(malicious_xml), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "doctype" in res.json()["detail"].lower() or "entity" in res.json()["detail"].lower()


def test_9_importar_xmi_sin_modelo_uml_rechazado():
    """9. XML sintácticamente válido pero sin modelo UML de clases es rechazado con 400."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Sin Clases")

    random_xml = b"""<?xml version="1.0"?><data><item>Sin UML</item></data>"""
    files = {"file": ("nodata.xmi", io.BytesIO(random_xml), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "no contiene un modelo uml" in res.json()["detail"].lower()


def test_10_importar_xmi_en_diagrama_no_vacio_rechazado():
    """10. Intentar importar XMI sobre un diagrama NO vacío es rechazado con 400 sin borrar ni sobrescribir."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] No Vacío")

    # Crear una clase existente
    client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": "ClasePrevia"})

    files = {"file": ("modelo.xmi", io.BytesIO(SAMPLE_XMI_CONTENT.encode("utf-8")), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "el diagrama debe estar vacío" in res.json()["detail"].lower()

    # Comprobar que ClasePrevia no fue borrada
    with SessionLocal() as db:
        clases = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).all()
        assert len(clases) == 1
        assert clases[0].nombre == "ClasePrevia"


def test_11_importacion_invalida_rollback_sin_persistencia_parcial():
    """11. Archivo con relación hacia ID inexistente falla y no deja datos parciales en la BD (rollback)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] Rollback")

    bad_rel_xml = b"""<?xml version="1.0" encoding="utf-8"?>
    <xmi:XMI xmi:version="2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1">
      <uml:Model name="M">
        <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Valida" />
        <packagedElement xmi:type="uml:Dependency" client="c1" supplier="clase_fantasma" />
      </uml:Model>
    </xmi:XMI>
    """
    files = {"file": ("corrupto.xmi", io.BytesIO(bad_rel_xml), "application/xml")}
    res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
    assert res.status_code == 400
    assert "clase_fantasma" in res.json()["detail"].lower()

    with SessionLocal() as db:
        assert db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_id).count() == 0


def test_12_diagram_changed_emitido_solo_tras_commit():
    """12. diagram.changed se emite a través de WebSocket únicamente tras el commit exitoso."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU08] WebSocket")

    files = {"file": ("modelo.xmi", io.BytesIO(SAMPLE_XMI_CONTENT.encode("utf-8")), "application/xml")}
    with patch("app.services.diagrama_service.DiagramaService._notify_diagram_changed") as mock_notify:
        res = client.post(f"/api/diagramas/{diag_id}/xmi/importar", headers=headers, files=files)
        assert res.status_code == 200
        mock_notify.assert_called_once_with(diag_id, 1)


def test_13_round_trip_completo_classflow_xmi_classflow():
    """13. Round-trip completo: Diagrama A -> Exportar XMI -> Importar en Diagrama B vacío -> Idéntico."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[CU09-08] RoundTrip A")
    _, diag_b = create_project_and_diagram(headers, "[CU09-08] RoundTrip B")

    # Poblar Diagrama A con Clases
    r1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Usuario", "visibilidad": "public", "es_abstracta": False})
    u_id = r1.json()["id_clase"]
    r2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Perfil", "visibilidad": "public", "es_abstracta": False})
    p_id = r2.json()["id_clase"]

    # Atributo y Método en Usuario
    client.post(f"/api/clases/{u_id}/atributos", headers=headers, json={"nombre": "email", "tipo_dato": "String", "visibilidad": "private"})
    rm = client.post(f"/api/clases/{u_id}/metodos", headers=headers, json={"nombre": "autenticar", "tipo_retorno": "Boolean", "visibilidad": "public"})
    m_id = rm.json()["id_metodo"]
    client.post(f"/api/metodos/{m_id}/parametros", headers=headers, json={"nombre": "password", "tipo_dato": "String"})

    # Relación uno a uno
    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": u_id,
        "id_clase_destino": p_id,
        "tipo": "asociacion",
        "nombre": "tienePerfil",
        "multiplicidad_origen": "1",
        "multiplicidad_destino": "1",
    })

    # 1. Exportar XMI de Diagrama A
    res_exp = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers)
    assert res_exp.status_code == 200
    xmi_data = res_exp.content

    # 2. Importar en Diagrama B
    files = {"file": ("exportado.xmi", io.BytesIO(xmi_data), "application/xml")}
    res_imp = client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files=files)
    assert res_imp.status_code == 200

    # 3. Comprobar equivalencia en BD
    with SessionLocal() as db:
        clases_b = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_b).all()
        assert len(clases_b) == 2
        u_b = next(c for c in clases_b if c.nombre == "Usuario")
        p_b = next(c for c in clases_b if c.nombre == "Perfil")
        assert u_b.atributos[0].nombre == "email"
        assert u_b.metodos[0].nombre == "autenticar"
        assert u_b.metodos[0].tipo_retorno == "Boolean"
        assert u_b.metodos[0].parametros[0].nombre == "password"

        rels_b = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).all()
        assert len(rels_b) == 1
        assert rels_b[0].tipo == "asociacion"
        assert rels_b[0].nombre == "tienePerfil"
        assert rels_b[0].multiplicidad_origen == "1"
        assert rels_b[0].multiplicidad_destino == "1"


def test_14_round_trip_metodos_y_parametros_sobreviven():
    """14. Métodos, parámetros y tipos de retorno (direction='return') sobreviven intactos sin mezclarse."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Metodos A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Metodos B")

    r = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Servicio"})
    s_id = r.json()["id_clase"]
    rm = client.post(f"/api/clases/{s_id}/metodos", headers=headers, json={"nombre": "procesarPago", "tipo_retorno": "Long", "visibilidad": "public"})
    m_id = rm.json()["id_metodo"]
    client.post(f"/api/metodos/{m_id}/parametros", headers=headers, json={"nombre": "monto", "tipo_dato": "Double"})
    client.post(f"/api/metodos/{m_id}/parametros", headers=headers, json={"nombre": "moneda", "tipo_dato": "String"})

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("m.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        s_b = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diag_b, ClaseUML.nombre == "Servicio").first()
        assert len(s_b.metodos) == 1
        met = s_b.metodos[0]
        assert met.nombre == "procesarPago"
        assert met.tipo_retorno == "Long"
        assert len(met.parametros) == 2
        p_names = [p.nombre for p in met.parametros]
        assert p_names == ["monto", "moneda"]
        # El tipo_retorno Long NO debe estar dentro de parametros
        assert "return" not in p_names


def test_15_round_trip_multiplicidades_sobreviven():
    """15. Multiplicidades '1', '0..1', '1..*', '0..*' sobreviven exactas."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Mults A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Mults B")

    c1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "A"}).json()["id_clase"]
    c2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "B"}).json()["id_clase"]

    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": c1,
        "id_clase_destino": c2,
        "tipo": "asociacion",
        "multiplicidad_origen": "0..1",
        "multiplicidad_destino": "1..*",
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("mults.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        rel = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert rel.multiplicidad_origen == "0..1"
        assert rel.multiplicidad_destino == "1..*"


def test_16_round_trip_asociacion_sobrevive():
    """16. Asociación directa sobrevive con tipo 'asociacion'."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Assoc A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Assoc B")

    c1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Profesor"}).json()["id_clase"]
    c2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Curso"}).json()["id_clase"]
    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": c1, "id_clase_destino": c2, "tipo": "asociacion", "nombre": "dicta"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "asociacion"
        assert r.nombre == "dicta"


def test_17_round_trip_agregacion_sobrevive():
    """17. Agregación (shared) sobrevive con tipo 'agregacion'."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Agreg A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Agreg B")

    c1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Empresa"}).json()["id_clase"]
    c2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Empleado"}).json()["id_clase"]
    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": c1, "id_clase_destino": c2, "tipo": "agregacion"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "agregacion"


def test_18_round_trip_composicion_sobrevive():
    """18. Composición (composite) sobrevive con tipo 'composicion'."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Comp A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Comp B")

    c1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Coche"}).json()["id_clase"]
    c2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Motor"}).json()["id_clase"]
    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": c1, "id_clase_destino": c2, "tipo": "composicion"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "composicion"


def test_19_round_trip_herencia_conserva_hija_a_padre():
    """19. Herencia conserva semánticamente clase hija (origen) -> clase padre (destino)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Herencia A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Herencia B")

    padre = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Animal", "es_abstracta": True}).json()["id_clase"]
    hija = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Perro"}).json()["id_clase"]

    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": hija, "id_clase_destino": padre, "tipo": "herencia"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "herencia"
        c_orig = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_origen).first()
        c_dest = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_destino).first()
        assert c_orig.nombre == "Perro"
        assert c_dest.nombre == "Animal"
        assert c_dest.es_abstracta is True


def test_20_round_trip_dependencia_conserva_client_supplier():
    """20. Dependencia conserva client (origen) -> supplier (destino)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Dep A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Dep B")

    c1 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Controlador"}).json()["id_clase"]
    c2 = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "Repositorio"}).json()["id_clase"]
    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": c1, "id_clase_destino": c2, "tipo": "dependencia", "nombre": "usa"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "dependencia"
        assert r.nombre == "usa"
        c_orig = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_origen).first()
        c_dest = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_destino).first()
        assert c_orig.nombre == "Controlador"
        assert c_dest.nombre == "Repositorio"


def test_21_round_trip_realizacion_conserva_client_supplier():
    """21. Realización conserva client (origen) -> supplier (destino/interfaz)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_a = create_project_and_diagram(headers, "[RT] Realiz A")
    _, diag_b = create_project_and_diagram(headers, "[RT] Realiz B")

    impl = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "UsuarioServiceImpl"}).json()["id_clase"]
    interf = client.post(f"/api/diagramas/{diag_a}/clases", headers=headers, json={"nombre": "UsuarioService", "estereotipo": "«interface»"}).json()["id_clase"]

    client.post(f"/api/diagramas/{diag_a}/relaciones", headers=headers, json={
        "id_clase_origen": impl, "id_clase_destino": interf, "tipo": "realizacion"
    })

    xmi = client.get(f"/api/diagramas/{diag_a}/xmi/exportar", headers=headers).content
    client.post(f"/api/diagramas/{diag_b}/xmi/importar", headers=headers, files={"file": ("f.xmi", io.BytesIO(xmi), "application/xml")})

    with SessionLocal() as db:
        r = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diag_b).first()
        assert r.tipo == "realizacion"
        c_orig = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_origen).first()
        c_dest = db.query(ClaseUML).filter(ClaseUML.id_clase == r.id_clase_destino).first()
        assert c_orig.nombre == "UsuarioServiceImpl"
        assert c_dest.nombre == "UsuarioService"
