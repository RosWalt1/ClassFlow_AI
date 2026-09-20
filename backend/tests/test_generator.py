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


def create_project_and_diagram(headers: dict, nombre: str = "[TEST-CU10] Proyecto Backend") -> tuple[int, int]:
    res_p = client.post("/api/proyectos", headers=headers, json={"nombre": nombre, "descripcion": "Desc CU10"})
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
# PRUEBAS OFICIALES DE FASE 10 — CU10 GENERAR BACKEND
# =============================================================================

def test_1_propietario_puede_generar_backend():
    """1. Propietario del proyecto puede generar el backend exitosamente."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-1] Propietario OK")

    create_class(headers, diag_id, "Cliente", [
        {"nombre": "id", "tipo_dato": "Long", "es_nullable": False},
        {"nombre": "nombre", "tipo_dato": "String", "es_nullable": False},
    ])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "Java 17" in data["framework"]
    assert data["metrics"]["total_classes"] == 1
    assert data["metrics"]["total_files"] >= 6  # Entity, Repo, Svc, Ctrl, pom, App, props


def test_2_invitado_recibe_403_al_generar():
    """2. Desarrollador invitado recibe 403 Forbidden al intentar generar backend."""
    token_carlos = get_token("carlos@classflow.com")
    token_ana = get_token("ana@classflow.com")
    headers_c = {"Authorization": f"Bearer {token_carlos}"}
    headers_a = {"Authorization": f"Bearer {token_ana}"}

    proj_id, diag_id = create_project_and_diagram(headers_c, "[CU10-2] 403 Invitado")
    create_class(headers_c, diag_id, "Producto", [{"nombre": "precio", "tipo_dato": "BigDecimal"}])

    # Invitar a Ana como colaboradora
    client.post(f"/api/proyectos/{proj_id}/colaboradores", headers=headers_c, json={"email": "ana@classflow.com", "permiso_edicion": True})

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers_a)
    assert res.status_code == 403
    assert "solo el propietario" in res.json()["detail"].lower()


def test_3_usuario_sin_autenticacion_recibe_401():
    """3. Petición no autenticada recibe 401 Unauthorized."""
    res = client.post("/api/diagramas/999/backend/generar")
    assert res.status_code == 401


def test_4_diagrama_vacio_produce_error_controlado():
    """4. Diagrama sin clases produce 400 Bad Request descriptivo."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-4] Vacío")

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 400
    assert "vacío" in res.json()["detail"].lower()


def test_5_tipo_no_soportado_produce_error_400():
    """5. Atributo con tipo no soportado (ej. Double, Float, Object) produce 400 descriptivo."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-5] Tipo Invalido")

    create_class(headers, diag_id, "Sensor", [
        {"nombre": "temperatura", "tipo_dato": "Double"},
    ])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "Double" in detail
    assert "no está soportado" in detail


def test_6_generacion_de_entity():
    """6. Generación de Entity con anotaciones JPA, paquete, getters y setters."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-6] Entity")

    create_class(headers, diag_id, "Usuario", [
        {"nombre": "email", "tipo_dato": "String", "es_nullable": False},
        {"nombre": "activo", "tipo_dato": "Boolean"},
    ])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "Usuario.java" in files
    entity_code = files["Usuario.java"]
    assert "@Entity" in entity_code
    assert '@Table(name = "usuario")' in entity_code
    assert "@Id" in entity_code
    assert "private Long id;" in entity_code  # ID sintético generado
    assert "private String email;" in entity_code
    assert "private Boolean activo;" in entity_code
    assert "public String getEmail()" in entity_code
    assert "public void setEmail(String email)" in entity_code


def test_7_generacion_de_repository():
    """7. Generación de Repository con JpaRepository y tipo de ID exacto."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-7] Repository")

    create_class(headers, diag_id, "Factura", [
        {"nombre": "id", "tipo_dato": "Long"},
        {"nombre": "codigo", "tipo_dato": "String"},
    ])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "FacturaRepository.java" in files
    repo_code = files["FacturaRepository.java"]
    assert "@Repository" in repo_code
    assert "public interface FacturaRepository extends JpaRepository<Factura, Long>" in repo_code


def test_8_generacion_de_service():
    """8. Generación de Service con @Service, @Transactional e inyección de dependencia."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-8] Service")

    create_class(headers, diag_id, "Cliente", [{"nombre": "id", "tipo_dato": "Long"}])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "ClienteService.java" in files
    svc_code = files["ClienteService.java"]
    assert "@Service" in svc_code
    assert "@Transactional" in svc_code
    assert "private final ClienteRepository repository;" in svc_code
    assert "public List<Cliente> findAll()" in svc_code
    assert "public Cliente save(Cliente cliente)" in svc_code


def test_9_generacion_de_controller():
    """9. Generación de Controller con @RestController, @RequestMapping y endpoints REST."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-9] Controller")

    create_class(headers, diag_id, "Pedido", [{"nombre": "id", "tipo_dato": "Long"}])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "PedidoController.java" in files
    ctrl_code = files["PedidoController.java"]
    assert "@RestController" in ctrl_code
    assert '@RequestMapping("/api/v1/pedidos")' in ctrl_code
    assert "@GetMapping" in ctrl_code
    assert '@GetMapping("/{id}")' in ctrl_code
    assert "@PostMapping" in ctrl_code
    assert '@DeleteMapping("/{id}")' in ctrl_code


def test_10_generacion_de_pom_xml():
    """10. Generación de pom.xml para Java 17 con dependencias Web, Data JPA y PostgreSQL."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-10] Pom")

    create_class(headers, diag_id, "Articulo", [{"nombre": "nombre", "tipo_dato": "String"}])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "pom.xml" in files
    pom = files["pom.xml"]
    assert "<java.version>17</java.version>" in pom
    assert "spring-boot-starter-web" in pom
    assert "spring-boot-starter-data-jpa" in pom
    assert "postgresql" in pom


def test_11_configuracion_postgresql():
    """11. Configuración de PostgreSQL en application.properties."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-11] Properties")

    create_class(headers, diag_id, "Categoria", [{"nombre": "nombre", "tipo_dato": "String"}])

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "application.properties" in files
    props = files["application.properties"]
    assert "spring.datasource.url=jdbc:postgresql:" in props
    assert "spring.datasource.driver-class-name=org.postgresql.Driver" in props
    assert "spring.jpa.hibernate.ddl-auto=update" in props


def test_12_mapeo_string():
    """12. Mapeo de atributo String."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-12] String")

    create_class(headers, diag_id, "Persona", [{"nombre": "apellidos", "tipo_dato": "String"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Persona.java"][0]
    assert "private String apellidos;" in entity_code


def test_13_mapeo_long():
    """13. Mapeo de atributo Long."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-13] Long")

    create_class(headers, diag_id, "Inventario", [{"nombre": "stock", "tipo_dato": "Long"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Inventario.java"][0]
    assert "private Long stock;" in entity_code


def test_14_mapeo_integer():
    """14. Mapeo de atributo Integer (y Repository con Integer si el ID es Integer)."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-14] Integer")

    create_class(headers, diag_id, "Nivel", [
        {"nombre": "id", "tipo_dato": "Integer"},
        {"nombre": "puntos", "tipo_dato": "Integer"},
    ])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    assert "private Integer id;" in files["Nivel.java"]
    assert "private Integer puntos;" in files["Nivel.java"]
    assert "JpaRepository<Nivel, Integer>" in files["NivelRepository.java"]


def test_15_mapeo_boolean():
    """15. Mapeo de atributo Boolean."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-15] Boolean")

    create_class(headers, diag_id, "Config", [{"nombre": "habilitado", "tipo_dato": "Boolean"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Config.java"][0]
    assert "private Boolean habilitado;" in entity_code


def test_16_mapeo_bigdecimal():
    """16. Mapeo de BigDecimal e import de java.math.BigDecimal."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-16] BigDecimal")

    create_class(headers, diag_id, "Pago", [{"nombre": "monto", "tipo_dato": "BigDecimal"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Pago.java"][0]
    assert "import java.math.BigDecimal;" in entity_code
    assert "private BigDecimal monto;" in entity_code


def test_17_mapeo_localdate():
    """17. Mapeo de LocalDate e import de java.time.LocalDate."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-17] LocalDate")

    create_class(headers, diag_id, "Contrato", [{"nombre": "fechaVencimiento", "tipo_dato": "LocalDate"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Contrato.java"][0]
    assert "import java.time.LocalDate;" in entity_code
    assert "private LocalDate fechaVencimiento;" in entity_code


def test_18_mapeo_localdatetime():
    """18. Mapeo de LocalDateTime e import de java.time.LocalDateTime."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-18] LocalDateTime")

    create_class(headers, diag_id, "Auditoria", [{"nombre": "fechaHora", "tipo_dato": "LocalDateTime"}])
    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    entity_code = [f["content"] for f in res.json()["files"] if f["name"] == "Auditoria.java"][0]
    assert "import java.time.LocalDateTime;" in entity_code
    assert "private LocalDateTime fechaHora;" in entity_code


def test_19_relacion_uno_a_uno():
    """19. Relación 1:1 con @OneToOne."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-19] 1:1")

    c1 = create_class(headers, diag_id, "Usuario", [{"nombre": "id", "tipo_dato": "Long"}])
    c2 = create_class(headers, diag_id, "Perfil", [{"nombre": "id", "tipo_dato": "Long"}])

    client.post(f"/api/diagramas/{diag_id}/relaciones", headers=headers, json={
        "id_clase_origen": c1,
        "id_clase_destino": c2,
        "tipo": "asociacion",
        "multiplicidad_origen": "1",
        "multiplicidad_destino": "1",
    })

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    user_code = files["Usuario.java"]
    perfil_code = files["Perfil.java"]

    assert "@OneToOne" in user_code
    assert "private Perfil perfil;" in user_code
    assert '@OneToOne(mappedBy = "perfil")' in perfil_code
    assert "private Usuario usuario;" in perfil_code


def test_20_relacion_uno_a_muchos():
    """20. Relación 1:N con @OneToMany y @ManyToOne."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-20] 1:N")

    c1 = create_class(headers, diag_id, "Cliente", [{"nombre": "id", "tipo_dato": "Long"}])
    c2 = create_class(headers, diag_id, "Pedido", [{"nombre": "id", "tipo_dato": "Long"}])

    client.post(f"/api/diagramas/{diag_id}/relaciones", headers=headers, json={
        "id_clase_origen": c1,
        "id_clase_destino": c2,
        "tipo": "asociacion",
        "multiplicidad_origen": "1",
        "multiplicidad_destino": "0..*",
    })

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    cliente_code = files["Cliente.java"]
    pedido_code = files["Pedido.java"]

    assert '@OneToMany(mappedBy = "cliente", cascade = CascadeType.ALL)' in cliente_code
    assert "private List<Pedido> pedidos = new ArrayList<>();" in cliente_code
    assert "@ManyToOne(fetch = FetchType.LAZY)" in pedido_code
    assert "private Cliente cliente;" in pedido_code


def test_21_relacion_muchos_a_muchos():
    """21. Relación N:N con @ManyToMany y @JoinTable."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-21] N:N")

    c1 = create_class(headers, diag_id, "Estudiante", [{"nombre": "id", "tipo_dato": "Long"}])
    c2 = create_class(headers, diag_id, "Curso", [{"nombre": "id", "tipo_dato": "Long"}])

    client.post(f"/api/diagramas/{diag_id}/relaciones", headers=headers, json={
        "id_clase_origen": c1,
        "id_clase_destino": c2,
        "tipo": "asociacion",
        "multiplicidad_origen": "*",
        "multiplicidad_destino": "*",
    })

    res = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    assert res.status_code == 200
    files = {f["name"]: f["content"] for f in res.json()["files"]}

    estudiante_code = files["Estudiante.java"]
    curso_code = files["Curso.java"]

    assert "@ManyToMany" in estudiante_code
    assert "@JoinTable(" in estudiante_code
    assert "private List<Curso> cursos = new ArrayList<>();" in estudiante_code
    assert '@ManyToMany(mappedBy = "cursos")' in curso_code
    assert "private List<Estudiante> estudiantes = new ArrayList<>();" in curso_code


def test_22_generacion_determinista():
    """22. Generación determinista: el mismo modelo UML produce exactamente el mismo resultado."""
    token = get_token("carlos@classflow.com")
    headers = {"Authorization": f"Bearer {token}"}
    _, diag_id = create_project_and_diagram(headers, "[CU10-22] Determinismo")

    create_class(headers, diag_id, "A", [{"nombre": "campo1", "tipo_dato": "String"}])
    create_class(headers, diag_id, "B", [{"nombre": "campo2", "tipo_dato": "Integer"}])

    res1 = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)
    res2 = client.post(f"/api/diagramas/{diag_id}/backend/generar", headers=headers)

    assert res1.status_code == 200
    assert res2.status_code == 200

    data1 = res1.json()
    data2 = res2.json()

    assert data1["metrics"] == data2["metrics"]
    assert len(data1["files"]) == len(data2["files"])
    for f1, f2 in zip(data1["files"], data2["files"]):
        assert f1["path"] == f2["path"]
        assert f1["content"] == f2["content"]
