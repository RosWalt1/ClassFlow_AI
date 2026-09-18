import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.proyecto import Proyecto, ProyectoColaborador
from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML

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


@pytest.fixture(scope="module")
def proyecto_base(tokens):
    """Crea un proyecto de prueba específico para la suite de diagramas UML."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    res = client.post(
        "/api/proyectos",
        json={
            "nombre": "[TEST-CU03] Sistema Pedidos UML",
            "descripcion": "Proyecto para validación de CU03",
        },
        headers=headers_carlos,
    )
    assert res.status_code == 201
    return res.json()


# =============================================================================
# 1. ACCESO Y AUTORIZACIÓN AL DIAGRAMA
# =============================================================================
def test_diagrama_sin_jwt_retorna_401():
    """Usuario sin JWT no accede al diagrama."""
    res = client.get("/api/proyectos/1/diagrama")
    assert res.status_code == 401


def test_propietario_consulta_diagrama(tokens, proyecto_base):
    """Propietario puede consultar diagrama y obtiene permiso_edicion=True."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}
    proj_id = proyecto_base["id_proyecto"]

    res = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res.status_code == 200
    diag = res.json()
    assert diag["id_proyecto"] == proj_id
    assert diag["es_propietario"] is True
    assert diag["permiso_edicion"] is True


def test_colaborador_activo_con_edicion_consulta_diagrama(tokens, proyecto_base):
    """Colaborador activo con edición puede consultar y obtiene permiso_edicion=True."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}
    proj_id = proyecto_base["id_proyecto"]

    # Invitar a Ana con permiso_edicion=True
    res_inv = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )
    assert res_inv.status_code in (200, 201)

    res = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_ana)
    assert res.status_code == 200
    diag = res.json()
    assert diag["es_propietario"] is False
    assert diag["permiso_edicion"] is True


def test_colaborador_solo_lectura_consulta_pero_no_edita(tokens, proyecto_base):
    """Colaborador con permiso_edicion=False puede consultar pero recibe 403 en escritura."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}
    proj_id = proyecto_base["id_proyecto"]

    # Cambiar permiso de Ana a solo lectura
    res_list = client.get(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_carlos)
    colab_ana = next(c for c in res_list.json() if c["email"] == "ana@classflow.com")
    res_patch = client.patch(
        f"/api/proyectos/{proj_id}/colaboradores/{colab_ana['id_colaborador']}",
        json={"permiso_edicion": False},
        headers=headers_carlos,
    )
    assert res_patch.status_code == 200

    # 1. Ana consulta -> 200 OK, permiso_edicion=False
    res_get = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_ana)
    assert res_get.status_code == 200
    diag = res_get.json()
    assert diag["permiso_edicion"] is False
    diagrama_id = diag["id_diagrama"]

    # 2. Ana intenta crear clase -> 403 Forbidden
    res_post_clase = client.post(
        f"/api/diagramas/{diagrama_id}/clases",
        json={"nombre": "IntentoFallido", "posicion_x": 0, "posicion_y": 0},
        headers=headers_ana,
    )
    assert res_post_clase.status_code == 403
    assert "permiso de edición" in res_post_clase.json()["detail"].lower()

    # Restaurar permiso de Ana para pruebas siguientes
    client.patch(
        f"/api/proyectos/{proj_id}/colaboradores/{colab_ana['id_colaborador']}",
        json={"permiso_edicion": True},
        headers=headers_carlos,
    )


def test_usuario_ajeno_bloqueado_en_diagrama(tokens, proyecto_base):
    """Usuario ajeno recibe 403 en consulta y edición."""
    headers_luis = {"Authorization": f"Bearer {tokens['luis']}"}
    proj_id = proyecto_base["id_proyecto"]

    # Consulta -> 403
    res_get = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_luis)
    assert res_get.status_code == 403


def test_colaborador_revocado_bloqueado_en_diagrama(tokens):
    """Colaborador revocado pierde acceso al diagrama."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}

    # Carlos crea proyecto
    res_p = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-REVOCADO] Proyecto Diag", "descripcion": "Revocado"},
        headers=headers_carlos,
    )
    proj_id = res_p.json()["id_proyecto"]

    # Invitar a Ana
    res_inv = client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        json={"email": "ana@classflow.com", "permiso_edicion": True},
        headers=headers_carlos,
    )
    colab_id = res_inv.json()["id_colaborador"]

    # Revocar a Ana
    client.delete(f"/api/proyectos/{proj_id}/colaboradores/{colab_id}", headers=headers_carlos)

    # Ana intenta consultar diagrama -> 403
    res_ana = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_ana)
    assert res_ana.status_code == 403


def test_colaborador_pendiente_bloqueado_en_diagrama(tokens):
    """Colaborador pendiente no obtiene acceso al diagrama."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_luis = {"Authorization": f"Bearer {tokens['luis']}"}

    res_p = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-PENDIENTE-DIAG] Proyecto", "descripcion": "Pendiente"},
        headers=headers_carlos,
    )
    proj_id = res_p.json()["id_proyecto"]

    # Insertar colaborador pendiente en DB
    db = SessionLocal()
    try:
        colab = ProyectoColaborador(
            id_proyecto=proj_id,
            id_usuario=tokens["luis_user"]["id_usuario"],
            permiso_edicion=True,
            estado="pendiente",
            fecha_invitacion=datetime.now(),
        )
        db.add(colab)
        db.commit()
    finally:
        db.close()

    res_luis = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_luis)
    assert res_luis.status_code == 403


# =============================================================================
# 2. CRUD CLASES UML Y PERSISTENCIA
# =============================================================================
def test_crud_clase_uml(tokens, proyecto_base):
    """Crear, consultar, modificar, mover y verificar persistencia de clase UML."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    proj_id = proyecto_base["id_proyecto"]

    res_diag = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_carlos)
    diag_id = res_diag.json()["id_diagrama"]

    # 1. Crear Clase
    res_crear = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={
            "nombre": "OrdenCompra",
            "estereotipo": "«entity»",
            "visibilidad": "public",
            "es_abstracta": False,
            "posicion_x": 150.5,
            "posicion_y": 220.0,
            "ancho": 240.0,
            "alto": 180.0,
        },
        headers=headers_carlos,
    )
    assert res_crear.status_code == 201
    clase = res_crear.json()
    clase_id = clase["id_clase"]
    assert clase["nombre"] == "OrdenCompra"
    assert clase["posicion_x"] == 150.5
    assert clase["posicion_y"] == 220.0

    # 2. Rechazar clase duplicada en el mismo diagrama
    res_dup = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ordencompra", "posicion_x": 0, "posicion_y": 0},
        headers=headers_carlos,
    )
    assert res_dup.status_code == 400
    assert "ya existe" in res_dup.json()["detail"].lower()

    # 3. Modificar propiedades de la clase
    res_upd = client.put(
        f"/api/diagramas/{diag_id}/clases/{clase_id}",
        json={
            "nombre": "PedidoCliente",
            "estereotipo": "«aggregate»",
            "es_abstracta": True,
            "visibilidad": "public",
        },
        headers=headers_carlos,
    )
    assert res_upd.status_code == 200
    clase_upd = res_upd.json()
    assert clase_upd["nombre"] == "PedidoCliente"
    assert clase_upd["estereotipo"] == "«aggregate»"
    assert clase_upd["es_abstracta"] is True

    # 4. Mover posición de la clase (PATCH posicion)
    res_pos = client.patch(
        f"/api/diagramas/{diag_id}/clases/{clase_id}/posicion",
        json={"posicion_x": 500.0, "posicion_y": 350.0},
        headers=headers_carlos,
    )
    assert res_pos.status_code == 200
    assert res_pos.json()["posicion_x"] == 500.0
    assert res_pos.json()["posicion_y"] == 350.0

    # 5. Consultar diagrama y verificar persistencia
    res_check = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_carlos)
    diag_check = res_check.json()
    clase_en_diag = next(c for c in diag_check["clases"] if c["id_clase"] == clase_id)
    assert clase_en_diag["nombre"] == "PedidoCliente"
    assert clase_en_diag["posicion_x"] == 500.0
    assert clase_en_diag["posicion_y"] == 350.0


# =============================================================================
# 3. CRUD ATRIBUTOS UML
# =============================================================================
def test_crud_atributos_uml(tokens, proyecto_base):
    """Crear, modificar y eliminar atributos UML en una clase."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_ana = {"Authorization": f"Bearer {tokens['ana']}"}
    proj_id = proyecto_base["id_proyecto"]

    res_diag = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_carlos)
    diag_id = res_diag.json()["id_diagrama"]

    # Crear clase de prueba
    res_clase = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "FacturaFiscal", "posicion_x": 100, "posicion_y": 100},
        headers=headers_carlos,
    )
    clase_id = res_clase.json()["id_clase"]

    # 1. Colaborador autorizado (Ana) agrega atributo
    res_attr1 = client.post(
        f"/api/clases/{clase_id}/atributos",
        json={
            "nombre": "numeroControl",
            "tipo_dato": "String",
            "visibilidad": "private",
            "es_nullable": False,
            "es_estatico": False,
            "es_final": True,
            "orden": 1,
        },
        headers=headers_ana,
    )
    assert res_attr1.status_code == 201
    attr1 = res_attr1.json()
    attr_id = attr1["id_atributo"]
    assert attr1["nombre"] == "numeroControl"
    assert attr1["tipo_dato"] == "String"
    assert attr1["es_final"] is True

    # 2. Modificar atributo
    res_upd = client.put(
        f"/api/atributos/{attr_id}",
        json={
            "nombre": "numeroFiscal",
            "tipo_dato": "String",
            "visibilidad": "protected",
            "valor_defecto": "N/A",
        },
        headers=headers_ana,
    )
    assert res_upd.status_code == 200
    attr_upd = res_upd.json()
    assert attr_upd["nombre"] == "numeroFiscal"
    assert attr_upd["visibilidad"] == "protected"
    assert attr_upd["valor_defecto"] == "N/A"

    # 3. Eliminar atributo
    res_del = client.delete(f"/api/atributos/{attr_id}", headers=headers_ana)
    assert res_del.status_code == 200

    # Verificar que ya no está en la clase
    res_clase_check = client.get(f"/api/diagramas/{diag_id}/clases/{clase_id}", headers=headers_carlos)
    assert not any(a["id_atributo"] == attr_id for a in res_clase_check.json()["atributos"])


# =============================================================================
# 4. CRUD MÉTODOS Y PARÁMETROS UML
# =============================================================================
def test_crud_metodos_y_parametros_uml(tokens, proyecto_base):
    """Crear, modificar y eliminar métodos y parámetros UML."""
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    proj_id = proyecto_base["id_proyecto"]

    res_diag = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers_carlos)
    diag_id = res_diag.json()["id_diagrama"]

    res_clase = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ServicioPago", "posicion_x": 200, "posicion_y": 200},
        headers=headers_carlos,
    )
    clase_id = res_clase.json()["id_clase"]

    # 1. Crear método
    res_met = client.post(
        f"/api/clases/{clase_id}/metodos",
        json={
            "nombre": "procesarPago",
            "tipo_retorno": "Boolean",
            "visibilidad": "public",
            "es_estatico": False,
            "es_abstracto": False,
            "orden": 1,
        },
        headers=headers_carlos,
    )
    assert res_met.status_code == 201
    met = res_met.json()
    met_id = met["id_metodo"]
    assert met["nombre"] == "procesarPago"
    assert met["tipo_retorno"] == "Boolean"

    # 2. Agregar parámetros al método
    res_p1 = client.post(
        f"/api/metodos/{met_id}/parametros",
        json={"nombre": "monto", "tipo_dato": "BigDecimal", "orden": 1},
        headers=headers_carlos,
    )
    assert res_p1.status_code == 201
    p1_id = res_p1.json()["id_parametro"]

    res_p2 = client.post(
        f"/api/metodos/{met_id}/parametros",
        json={"nombre": "moneda", "tipo_dato": "String", "valor_defecto": "USD", "orden": 2},
        headers=headers_carlos,
    )
    assert res_p2.status_code == 201

    # 3. Modificar parámetro
    res_p_upd = client.put(
        f"/api/parametros/{p1_id}",
        json={"nombre": "montoTotal", "tipo_dato": "Double"},
        headers=headers_carlos,
    )
    assert res_p_upd.status_code == 200
    assert res_p_upd.json()["nombre"] == "montoTotal"
    assert res_p_upd.json()["tipo_dato"] == "Double"

    # 4. Modificar método
    res_m_upd = client.put(
        f"/api/metodos/{met_id}",
        json={"nombre": "ejecutarTransaccion", "tipo_retorno": "String"},
        headers=headers_carlos,
    )
    assert res_m_upd.status_code == 200
    assert res_m_upd.json()["nombre"] == "ejecutarTransaccion"

    # 5. Eliminar parámetro
    res_del_p = client.delete(f"/api/parametros/{p1_id}", headers=headers_carlos)
    assert res_del_p.status_code == 200

    # 6. Eliminar método
    res_del_m = client.delete(f"/api/metodos/{met_id}", headers=headers_carlos)
    assert res_del_m.status_code == 200


# =============================================================================
# 5. CRUD RELACIONES UML Y LOS 6 TIPOS OFICIALES
# =============================================================================
def test_relaciones_uml_y_tipos_admitidos(tokens, proyecto_base):
    """
    Verifica la persistencia de relaciones UML y los 6 tipos admitidos:
    asociacion, agregacion, composicion, herencia, dependencia, realizacion.
    """
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}
    proj_id = proyecto_base["id_proyecto"]

    res_diag = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    diag_id = res_diag.json()["id_diagrama"]

    # Crear 3 clases para relacionar
    c1 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "UsuarioBase", "posicion_x": 50, "posicion_y": 50},
        headers=headers,
    ).json()["id_clase"]

    c2 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ClientePremium", "posicion_x": 300, "posicion_y": 50},
        headers=headers,
    ).json()["id_clase"]

    c3 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "TarjetaFidelidad", "posicion_x": 600, "posicion_y": 50},
        headers=headers,
    ).json()["id_clase"]

    # 1. Herencia: ClientePremium hereda de UsuarioBase
    res_her = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c2,
            "id_clase_destino": c1,
            "tipo": "herencia",
            "nombre": "esUn",
        },
        headers=headers,
    )
    assert res_her.status_code == 201
    assert res_her.json()["tipo"] == "herencia"

    # 2. Composición: ClientePremium compone TarjetaFidelidad (1 a 1)
    res_comp = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c2,
            "id_clase_destino": c3,
            "tipo": "composicion",
            "multiplicidad_origen": "1",
            "multiplicidad_destino": "1",
            "rol_origen": "titular",
            "rol_destino": "tarjeta",
        },
        headers=headers,
    )
    assert res_comp.status_code == 201
    rel_comp_id = res_comp.json()["id_relacion"]
    assert res_comp.json()["tipo"] == "composicion"
    assert res_comp.json()["multiplicidad_origen"] == "1"
    assert res_comp.json()["multiplicidad_destino"] == "1"

    # 3. Asociación
    res_asoc = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c1,
            "id_clase_destino": c3,
            "tipo": "asociacion",
            "multiplicidad_origen": "1",
            "multiplicidad_destino": "0..*",
        },
        headers=headers,
    )
    assert res_asoc.status_code == 201

    # 4. Agregación
    res_agreg = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c1,
            "id_clase_destino": c2,
            "tipo": "agregacion",
        },
        headers=headers,
    )
    assert res_agreg.status_code == 201

    # 5. Dependencia
    res_dep = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c3,
            "id_clase_destino": c1,
            "tipo": "dependencia",
        },
        headers=headers,
    )
    assert res_dep.status_code == 201

    # 6. Realización
    res_real = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c2,
            "id_clase_destino": c3,
            "tipo": "realizacion",
        },
        headers=headers,
    )
    assert res_real.status_code == 201

    # 7. Rechazar tipo inválido
    res_inv = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c1,
            "id_clase_destino": c2,
            "tipo": "tipo_inexistente",
        },
        headers=headers,
    )
    assert res_inv.status_code == 400

    # 8. Modificar relación
    res_upd = client.put(
        f"/api/relaciones/{rel_comp_id}",
        json={"multiplicidad_destino": "0..1", "nombre": "asignacionDirecta"},
        headers=headers,
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["multiplicidad_destino"] == "0..1"
    assert res_upd.json()["nombre"] == "asignacionDirecta"

    # 9. Eliminar relación
    res_del = client.delete(f"/api/relaciones/{rel_comp_id}", headers=headers)
    assert res_del.status_code == 200


def test_rechazo_relacion_clases_diagramas_diferentes(tokens):
    """Rechazar relación entre clases de diagramas/proyectos diferentes."""
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    # Crear Proyecto A
    p_a = client.post("/api/proyectos", json={"nombre": "[TEST-A] Proyecto A"}, headers=headers).json()
    d_a = client.get(f"/api/proyectos/{p_a['id_proyecto']}/diagrama", headers=headers).json()
    c_a = client.post(
        f"/api/diagramas/{d_a['id_diagrama']}/clases",
        json={"nombre": "ClaseA", "posicion_x": 0, "posicion_y": 0},
        headers=headers,
    ).json()

    # Crear Proyecto B
    p_b = client.post("/api/proyectos", json={"nombre": "[TEST-B] Proyecto B"}, headers=headers).json()
    d_b = client.get(f"/api/proyectos/{p_b['id_proyecto']}/diagrama", headers=headers).json()
    c_b = client.post(
        f"/api/diagramas/{d_b['id_diagrama']}/clases",
        json={"nombre": "ClaseB", "posicion_x": 0, "posicion_y": 0},
        headers=headers,
    ).json()

    # Intentar relacionar ClaseA con ClaseB dentro del Diagrama A -> Debe rechazar con 400
    res_rel = client.post(
        f"/api/diagramas/{d_a['id_diagrama']}/relaciones",
        json={
            "id_clase_origen": c_a["id_clase"],
            "id_clase_destino": c_b["id_clase"],
            "tipo": "asociacion",
        },
        headers=headers,
    )
    assert res_rel.status_code == 400
    assert "no existe en este diagrama" in res_rel.json()["detail"].lower()


# =============================================================================
# 6. INTEGRIDAD REFERENCIAL AL ELIMINAR CLASE
# =============================================================================
def test_integridad_al_eliminar_clase_con_relaciones_y_elementos(tokens):
    """
    Al eliminar una clase, se deben limpiar de forma segura sus relaciones
    asociadas (origen o destino) y sus atributos/métodos/parámetros sin violar FK constraints.
    """
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    p = client.post("/api/proyectos", json={"nombre": "[TEST-DEL] Proyecto Integridad"}, headers=headers).json()
    diag = client.get(f"/api/proyectos/{p['id_proyecto']}/diagrama", headers=headers).json()
    diag_id = diag["id_diagrama"]

    # Crear 2 clases
    c1 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ClaseEliminar", "posicion_x": 0, "posicion_y": 0},
        headers=headers,
    ).json()["id_clase"]

    c2 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ClasePermanente", "posicion_x": 300, "posicion_y": 0},
        headers=headers,
    ).json()["id_clase"]

    # Agregar atributos y métodos a c1
    client.post(
        f"/api/clases/{c1}/atributos",
        json={"nombre": "campo1", "tipo_dato": "String"},
        headers=headers,
    )
    met = client.post(
        f"/api/clases/{c1}/metodos",
        json={"nombre": "metodo1", "tipo_retorno": "void"},
        headers=headers,
    ).json()["id_metodo"]
    client.post(
        f"/api/metodos/{met}/parametros",
        json={"nombre": "param1", "tipo_dato": "int"},
        headers=headers,
    )

    # Crear relación entre c1 y c2
    res_rel = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={"id_clase_origen": c1, "id_clase_destino": c2, "tipo": "asociacion"},
        headers=headers,
    )
    assert res_rel.status_code == 201
    rel_id = res_rel.json()["id_relacion"]

    # Eliminar c1 -> debe completarse sin error de FK
    res_del_c1 = client.delete(f"/api/diagramas/{diag_id}/clases/{c1}", headers=headers)
    assert res_del_c1.status_code == 200

    # Comprobar que en el diagrama ya no existe c1 ni la relación
    diag_after = client.get(f"/api/proyectos/{p['id_proyecto']}/diagrama", headers=headers).json()
    assert not any(c["id_clase"] == c1 for c in diag_after["clases"])
    assert not any(r["id_relacion"] == rel_id for r in diag_after["relaciones"])
    assert any(c["id_clase"] == c2 for c in diag_after["clases"])


# =============================================================================
# 7. AISLAMIENTO CRUZADO JERÁRQUICO POR ID ENTRE PROYECTOS DISTINTOS
# =============================================================================
def test_aislamiento_cruzado_proyectos(tokens):
    """
    Verifica que un usuario con acceso al Proyecto A NO pueda modificar ni eliminar
    atributos, métodos, parámetros, relaciones o clases del Proyecto B simplemente conociendo su ID.
    El servicio debe derivar toda la cadena de pertenencia jerárquica:
    recurso -> clase/método -> diagrama -> proyecto -> autorización (403 Forbidden).
    """
    headers_carlos = {"Authorization": f"Bearer {tokens['carlos']}"}
    headers_luis = {"Authorization": f"Bearer {tokens['luis']}"}

    # Carlos crea Proyecto B y todos sus elementos internos
    proj_b = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-ISOLATION] Proyecto B de Carlos"},
        headers=headers_carlos,
    ).json()
    diag_b = client.get(f"/api/proyectos/{proj_b['id_proyecto']}/diagrama", headers=headers_carlos).json()
    diag_b_id = diag_b["id_diagrama"]

    # Clases en Proyecto B
    clase_b1 = client.post(
        f"/api/diagramas/{diag_b_id}/clases",
        json={"nombre": "EntidadB1", "posicion_x": 100, "posicion_y": 100},
        headers=headers_carlos,
    ).json()["id_clase"]

    clase_b2 = client.post(
        f"/api/diagramas/{diag_b_id}/clases",
        json={"nombre": "EntidadB2", "posicion_x": 400, "posicion_y": 100},
        headers=headers_carlos,
    ).json()["id_clase"]

    # Atributo en clase_b1
    attr_b = client.post(
        f"/api/clases/{clase_b1}/atributos",
        json={"nombre": "secretoB", "tipo_dato": "String", "visibilidad": "private"},
        headers=headers_carlos,
    ).json()["id_atributo"]

    # Método en clase_b1
    met_b = client.post(
        f"/api/clases/{clase_b1}/metodos",
        json={"nombre": "operacionB", "tipo_retorno": "void", "visibilidad": "public"},
        headers=headers_carlos,
    ).json()["id_metodo"]

    # Parámetro en met_b
    param_b = client.post(
        f"/api/metodos/{met_b}/parametros",
        json={"nombre": "argB", "tipo_dato": "int"},
        headers=headers_carlos,
    ).json()["id_parametro"]

    # Relación entre clase_b1 y clase_b2
    rel_b = client.post(
        f"/api/diagramas/{diag_b_id}/relaciones",
        json={"id_clase_origen": clase_b1, "id_clase_destino": clase_b2, "tipo": "composicion"},
        headers=headers_carlos,
    ).json()["id_relacion"]

    # Luis (que no tiene acceso a Proyecto B) intenta mutar elementos de Proyecto B por ID:

    # 1. Actualizar y eliminar atributo de Proyecto B -> Rechazado (403)
    res_up_attr = client.put(
        f"/api/atributos/{attr_b}",
        json={"nombre": "hackeado"},
        headers=headers_luis,
    )
    assert res_up_attr.status_code == 403
    assert "no tienes permiso" in res_up_attr.json()["detail"].lower()

    res_del_attr = client.delete(
        f"/api/atributos/{attr_b}",
        headers=headers_luis,
    )
    assert res_del_attr.status_code == 403

    # 2. Actualizar y eliminar método de Proyecto B -> Rechazado (403)
    res_up_met = client.put(
        f"/api/metodos/{met_b}",
        json={"nombre": "hackMetodo"},
        headers=headers_luis,
    )
    assert res_up_met.status_code == 403

    res_del_met = client.delete(
        f"/api/metodos/{met_b}",
        headers=headers_luis,
    )
    assert res_del_met.status_code == 403

    # 3. Crear, actualizar y eliminar parámetro de Proyecto B -> Rechazado (403)
    res_create_param = client.post(
        f"/api/metodos/{met_b}/parametros",
        json={"nombre": "hackedParam", "tipo_dato": "String"},
        headers=headers_luis,
    )
    assert res_create_param.status_code == 403

    res_up_param = client.put(
        f"/api/parametros/{param_b}",
        json={"nombre": "hackParam"},
        headers=headers_luis,
    )
    assert res_up_param.status_code == 403

    res_del_param = client.delete(
        f"/api/parametros/{param_b}",
        headers=headers_luis,
    )
    assert res_del_param.status_code == 403

    # 4. Actualizar y eliminar relación de Proyecto B -> Rechazado (403)
    res_up_rel = client.put(
        f"/api/relaciones/{rel_b}",
        json={"tipo": "asociacion"},
        headers=headers_luis,
    )
    assert res_up_rel.status_code == 403

    res_del_rel = client.delete(
        f"/api/relaciones/{rel_b}",
        headers=headers_luis,
    )
    assert res_del_rel.status_code == 403

    # 5. Modificar y eliminar clase de Proyecto B -> Rechazado (403)
    res_up_clase = client.put(
        f"/api/diagramas/{diag_b_id}/clases/{clase_b1}",
        json={"nombre": "HackClass"},
        headers=headers_luis,
    )
    assert res_up_clase.status_code == 403

    res_del_clase = client.delete(
        f"/api/diagramas/{diag_b_id}/clases/{clase_b1}",
        headers=headers_luis,
    )
    assert res_del_clase.status_code == 403


# =============================================================================
# 8. VERIFICACIÓN DE LOS SEIS TIPOS OFICIALES Y RECHAZO DE TIPOS INVÁLIDOS/INGLESES
# =============================================================================
def test_verificar_los_seis_tipos_oficiales_y_rechazo_invalidos(tokens):
    """
    Verifica que la API:
    1. Acepta y persiste exactamente los 6 tipos oficiales en español:
       asociacion, agregacion, composicion, herencia, dependencia, realizacion.
    2. Rechaza cualquier tipo arbitrario con 400 Bad Request.
    3. Rechaza nombres en inglés (association, composition, etc.) con 400 Bad Request.
    4. Confirma que la BD nunca persiste nombres en inglés.
    """
    headers = {"Authorization": f"Bearer {tokens['carlos']}"}

    proj = client.post(
        "/api/proyectos",
        json={"nombre": "[TEST-6-TYPES] Verificación Tipos UML"},
        headers=headers,
    ).json()
    diag = client.get(f"/api/proyectos/{proj['id_proyecto']}/diagrama", headers=headers).json()
    diag_id = diag["id_diagrama"]

    # Crear 2 clases
    c1 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ClaseUno", "posicion_x": 50, "posicion_y": 50},
        headers=headers,
    ).json()["id_clase"]

    c2 = client.post(
        f"/api/diagramas/{diag_id}/clases",
        json={"nombre": "ClaseDos", "posicion_x": 350, "posicion_y": 50},
        headers=headers,
    ).json()["id_clase"]

    tipos_oficiales = [
        "asociacion",
        "agregacion",
        "composicion",
        "herencia",
        "dependencia",
        "realizacion",
    ]

    # Probar creación para cada uno de los 6 tipos oficiales
    created_rel_ids = []
    for tipo in tipos_oficiales:
        res = client.post(
            f"/api/diagramas/{diag_id}/relaciones",
            json={
                "id_clase_origen": c1,
                "id_clase_destino": c2,
                "tipo": tipo,
                "nombre": f"rel_{tipo}",
            },
            headers=headers,
        )
        assert res.status_code == 201, f"Fallo al crear tipo oficial {tipo}: {res.text}"
        data = res.json()
        assert data["tipo"] == tipo
        created_rel_ids.append(data["id_relacion"])

    # Probar rechazo de tipo arbitrario / inválido
    res_invalido = client.post(
        f"/api/diagramas/{diag_id}/relaciones",
        json={
            "id_clase_origen": c1,
            "id_clase_destino": c2,
            "tipo": "tipo_totalmente_invalido",
        },
        headers=headers,
    )
    assert res_invalido.status_code == 400
    assert "tipo de relación no válido" in res_invalido.json()["detail"].lower()

    # Probar rechazo de tipos en inglés
    tipos_ingleses = [
        "association",
        "aggregation",
        "composition",
        "inheritance",
        "dependency",
        "realization",
    ]
    for tipo_en in tipos_ingleses:
        res_en = client.post(
            f"/api/diagramas/{diag_id}/relaciones",
            json={
                "id_clase_origen": c1,
                "id_clase_destino": c2,
                "tipo": tipo_en,
            },
            headers=headers,
        )
        assert res_en.status_code == 400, f"Debería haber rechazado tipo en inglés {tipo_en}"
        assert "tipo de relación no válido" in res_en.json()["detail"].lower()

    # Probar rechazo al actualizar a tipo en inglés
    rel_prueba = created_rel_ids[0]
    res_up_en = client.put(
        f"/api/relaciones/{rel_prueba}",
        json={"tipo": "association"},
        headers=headers,
    )
    assert res_up_en.status_code == 400
    assert "tipo de relación no válido" in res_up_en.json()["detail"].lower()

    # Verificar que el diagrama persistido solo tiene tipos canónicos en español
    diag_check = client.get(f"/api/proyectos/{proj['id_proyecto']}/diagrama", headers=headers).json()
    for rel in diag_check["relaciones"]:
        assert rel["tipo"] in tipos_oficiales
        assert rel["tipo"] not in tipos_ingleses
