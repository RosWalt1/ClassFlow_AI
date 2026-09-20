import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# =============================================================================
# HELPERS
# =============================================================================
def get_token(email: str, password: str = "ClassFlow2026!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-CU11] Proyecto Download") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc CU11"})
    assert res_p.status_code == 201
    proj_id = res_p.json()["id_proyecto"]

    res_d = client.get(f"/api/proyectos/{proj_id}/diagrama", headers=headers)
    assert res_d.status_code == 200
    diag_id = res_d.json()["id_diagrama"]
    return proj_id, diag_id


def create_class(headers: dict, diag_id: int, nombre: str, atributos: list = None, metodos: list = None) -> int:
    res_c = client.post(f"/api/diagramas/{diag_id}/clases", headers=headers, json={"nombre": nombre})
    assert res_c.status_code == 201
    cid = res_c.json()["id_clase"]

    if atributos:
        for a in atributos:
            client.post(f"/api/clases/{cid}/atributos", headers=headers, json=a)

    if metodos:
        for m in metodos:
            client.post(f"/api/clases/{cid}/metodos", headers=headers, json=m)

    return cid


# =============================================================================
# PRUEBAS OFICIALES DE FASE 11 — CU11 DESCARGAR BACKEND GENERADO EN ZIP
# =============================================================================

def test_1_propietario_puede_descargar():
    """1. Propietario del proyecto puede descargar el backend generado como archivo ZIP."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-1] Propietario OK")

    create_class(headers, diag_id, "Cliente", [
        {"nombre": "id", "tipo_dato": "Long", "es_nullable": False},
        {"nombre": "nombre", "tipo_dato": "String", "es_nullable": False},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200
    assert len(res.content) > 0


def test_2_invitado_recibe_403():
    """2. Desarrollador invitado recibe 403 Forbidden al intentar descargar el backend."""
    token_carlos = get_token("carlos@classflow.com")
    token_ana = get_token("ana@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_a = {"Authorization": f"Bearer {token_ana}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU11-2] 403 Invitado")
    create_class(headers_c, diag_id, "Articulo", [{"nombre": "codigo", "tipo_dato": "String"}])

    # Invitar a Ana como colaboradora
    client.post(
        f"/api/proyectos/{proj_id}/colaboradores",
        headers=headers_c,
        json={"email": "ana@classflow.com", "permiso_edicion": True},
    )

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers_a)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_3_usuario_sin_token_recibe_401():
    """3. Usuario sin autenticación recibe 401 Unauthorized."""
    res = client.get("/api/diagramas/999/backend/descargar")
    assert res.status_code == 401


def test_4_respuesta_tiene_tipo_archivo_zip():
    """4. La respuesta HTTP tiene Content-Type application/zip y Content-Disposition con extensión .zip."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-4] Header ZIP")

    create_class(headers, diag_id, "Proveedor", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "razonSocial", "tipo_dato": "String"},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    disp = res.headers.get("content-disposition", "")
    assert "attachment;" in disp
    assert disp.endswith('.zip"') or ".zip" in disp


def test_5_zip_contiene_pom_xml():
    """5. El archivo ZIP contiene pom.xml con configuración de Maven y Java 17."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-5] Pom XML")

    create_class(headers, diag_id, "Categoria", [{"nombre": "nombre", "tipo_dato": "String"}])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        pom_files = [f for f in namelist if f.endswith("pom.xml")]
        assert len(pom_files) == 1
        pom_content = zf.read(pom_files[0]).decode("utf-8")
        assert "<java.version>17</java.version>" in pom_content
        assert "spring-boot-starter-data-jpa" in pom_content
        assert "spring-boot-starter-web" in pom_content
        assert "postgresql" in pom_content


def test_6_zip_contiene_application_java():
    """6. El archivo ZIP contiene la clase principal Application.java con @SpringBootApplication."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-6] Application Java")

    create_class(headers, diag_id, "Sucursal", [{"nombre": "direccion", "tipo_dato": "String"}])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        app_files = [f for f in namelist if f.endswith("Application.java")]
        assert len(app_files) == 1
        app_content = zf.read(app_files[0]).decode("utf-8")
        assert "@SpringBootApplication" in app_content
        assert "SpringApplication.run(Application.class, args);" in app_content


def test_7_zip_contiene_application_properties():
    """7. El archivo ZIP contiene application.properties con la configuración de PostgreSQL."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-7] Properties")

    create_class(headers, diag_id, "Bodega", [{"nombre": "capacidad", "tipo_dato": "Integer"}])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        prop_files = [f for f in namelist if f.endswith("application.properties")]
        assert len(prop_files) == 1
        prop_content = zf.read(prop_files[0]).decode("utf-8")
        assert "spring.datasource.url=" in prop_content
        assert "jdbc:postgresql:" in prop_content
        assert "spring.jpa.hibernate.ddl-auto=update" in prop_content


def test_8_zip_contiene_entity_generadas():
    """8. El archivo ZIP contiene las clases @Entity generadas con sus anotaciones JPA."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-8] Entities")

    create_class(headers, diag_id, "Factura", [
        {"nombre": "id", "tipo_dato": "Long", "es_nullable": False},
        {"nombre": "total", "tipo_dato": "BigDecimal", "es_nullable": False},
        {"nombre": "fechaEmision", "tipo_dato": "LocalDate"},
    ])
    create_class(headers, diag_id, "ItemFactura", [
        {"nombre": "cantidad", "tipo_dato": "Integer"},
        {"nombre": "subtotal", "tipo_dato": "BigDecimal"},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        factura_files = [f for f in namelist if f.endswith("model/Factura.java")]
        item_files = [f for f in namelist if f.endswith("model/ItemFactura.java")]
        assert len(factura_files) == 1
        assert len(item_files) == 1

        factura_code = zf.read(factura_files[0]).decode("utf-8")
        assert "@Entity" in factura_code
        assert "@Table(name = \"factura\")" in factura_code
        assert "private Long id;" in factura_code
        assert "private BigDecimal total;" in factura_code
        assert "public BigDecimal getTotal()" in factura_code

        item_code = zf.read(item_files[0]).decode("utf-8")
        assert "@Entity" in item_code
        assert "private Long id;" in item_code  # Sintético
        assert "@Id" in item_code


def test_9_zip_contiene_repository_generadas():
    """9. El archivo ZIP contiene los repositorios Spring Data JPA generados."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-9] Repositories")

    create_class(headers, diag_id, "Venta", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "monto", "tipo_dato": "BigDecimal"},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        repo_files = [f for f in namelist if f.endswith("repository/VentaRepository.java")]
        assert len(repo_files) == 1
        repo_code = zf.read(repo_files[0]).decode("utf-8")
        assert "@Repository" in repo_code
        assert "public interface VentaRepository extends JpaRepository<Venta, Long>" in repo_code


def test_10_zip_contiene_service_generados():
    """10. El archivo ZIP contiene los servicios de negocio @Service con soporte @Transactional."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-10] Services")

    create_class(headers, diag_id, "UsuarioSistema", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "username", "tipo_dato": "String"},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        svc_files = [f for f in namelist if f.endswith("service/UsuarioSistemaService.java")]
        assert len(svc_files) == 1
        svc_code = zf.read(svc_files[0]).decode("utf-8")
        assert "@Service" in svc_code
        assert "@Transactional" in svc_code
        assert "public List<UsuarioSistema> findAll()" in svc_code
        assert "public Optional<UsuarioSistema> findById(Long id)" in svc_code
        assert "public UsuarioSistema save(UsuarioSistema usuarioSistema)" in svc_code
        assert "public void deleteById(Long id)" in svc_code


def test_11_zip_contiene_controller_generados():
    """11. El archivo ZIP contiene los controladores @RestController con endpoints CRUD mapeados."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-11] Controllers")

    create_class(headers, diag_id, "Pedido", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "numero", "tipo_dato": "String"},
    ])

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 200

    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        namelist = zf.namelist()
        ctrl_files = [f for f in namelist if f.endswith("controller/PedidoController.java")]
        assert len(ctrl_files) == 1
        ctrl_code = zf.read(ctrl_files[0]).decode("utf-8")
        assert "@RestController" in ctrl_code
        assert '@RequestMapping("/api/v1/pedidos")' in ctrl_code
        assert "@GetMapping" in ctrl_code
        assert "@PostMapping" in ctrl_code
        assert "@DeleteMapping" in ctrl_code


def test_12_mismo_diagrama_produce_zip_determinista():
    """12. Dos descargas consecutivas sobre el mismo diagrama generan un ZIP binariamente idéntico."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-12] Determinismo ZIP")

    create_class(headers, diag_id, "DeterminismoEntity", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "activo", "tipo_dato": "Boolean"},
    ])

    res1 = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    res2 = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.content == res2.content, "Los bytes del archivo ZIP deben ser estrictamente idénticos y deterministas."


def test_13_diagrama_vacio_produce_error_400_al_descargar():
    """13. Intentar descargar un diagrama sin clases produce 400 Bad Request."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU11-13] Vacio")

    res = client.get(f"/api/diagramas/{diag_id}/backend/descargar", headers=headers)
    assert res.status_code == 400
    assert "vacío" in res.json()["detail"].lower()
