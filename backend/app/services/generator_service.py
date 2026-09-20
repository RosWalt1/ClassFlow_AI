import io
import re
import zipfile
from typing import Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.services.diagrama_service import DiagramaService
from app.schemas.generator import BackendGenerateResponse, GeneratedFileItem, GenerationMetrics

# =============================================================================
# CONSTANTES DE TIPADO Y LENGUAJE (JAVA 17 + SPRING BOOT)
# =============================================================================
BASE_PACKAGE = "com.app.generated"

# Tipos estrictamente soportados en Fase 10 según DEVELOPMENT_PLAN.md
SUPPORTED_TYPES_MAP: Dict[str, str] = {
    "string": "String",
    "long": "Long",
    "integer": "Integer",
    "int": "Integer",
    "boolean": "Boolean",
    "bool": "Boolean",
    "bigdecimal": "BigDecimal",
    "localdate": "LocalDate",
    "localdatetime": "LocalDateTime",
}

TYPE_IMPORTS: Dict[str, str] = {
    "BigDecimal": "import java.math.BigDecimal;",
    "LocalDate": "import java.time.LocalDate;",
    "LocalDateTime": "import java.time.LocalDateTime;",
}


def _capitalize(s: str) -> str:
    if not s:
        return ""
    return s[0].upper() + s[1:]


def _uncapitalize(s: str) -> str:
    if not s:
        return ""
    return s[0].lower() + s[1:]


def _pluralize(s: str) -> str:
    s_clean = s.strip()
    if s_clean.endswith(("s", "x", "z", "ch", "sh")):
        return f"{s_clean}es"
    return f"{s_clean}s"


def _to_snake_case(name: str) -> str:
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s).lower()


class BackendGeneratorService:
    """
    Servicio determinista de generación de código Java 17 + Spring Boot 3.2 + PostgreSQL (CU10).
    Exclusivo para el propietario del proyecto.
    """

    @classmethod
    def generar_backend(
        cls, db: Session, diagrama_id: int, user_id: int
    ) -> BackendGenerateResponse:
        """
        Valida el metamodelo UML almacenado en PostgreSQL y genera en memoria
        todos los artefactos de código fuente Spring Boot.
        """
        # 1. Autorización: SOLO PROPIETARIO
        _, es_propietario, _ = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=False
        )
        if not es_propietario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del proyecto puede generar el backend.",
            )

        # 2. Obtener Diagrama y entidades de PostgreSQL
        diagrama = db.query(Diagrama).filter(Diagrama.id_diagrama == diagrama_id).first()
        if not diagrama:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diagrama no encontrado.",
            )

        clases: List[ClaseUML] = (
            db.query(ClaseUML)
            .filter(ClaseUML.id_diagrama == diagrama_id)
            .order_by(ClaseUML.nombre, ClaseUML.id_clase)
            .all()
        )
        relaciones: List[RelacionUML] = (
            db.query(RelacionUML)
            .filter(RelacionUML.id_diagrama == diagrama_id)
            .order_by(RelacionUML.id_relacion)
            .all()
        )

        # 3. Validación previa del modelo
        if not clases:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El diagrama está vacío. Debe contener al menos una clase UML para generar el backend.",
            )

        cls._validar_modelo(clases, relaciones)

        # 4. Procesar herencias y relaciones por clase
        clase_by_id: Dict[int, ClaseUML] = {c.id_clase: c for c in clases}
        herencias_padre: Dict[int, str] = {}  # id_clase_hija -> nombre_clase_padre

        for rel in relaciones:
            if rel.tipo.strip().lower() == "herencia":
                padre = clase_by_id.get(rel.id_clase_destino)
                if padre:
                    herencias_padre[rel.id_clase_origen] = padre.nombre

        # 5. Generación determinista de artefactos Java
        generated_files: List[GeneratedFileItem] = []
        total_attrs = sum(len(c.atributos) for c in clases)
        total_methods = sum(len(c.metodos) for c in clases)

        for c in clases:
            padre_nombre = herencias_padre.get(c.id_clase)
            id_attr_name, id_attr_type, is_synthetic_id = cls._resolve_id_attribute(c)

            # A) Entity
            entity_content = cls._generate_entity(
                clase=c,
                clases_all=clases,
                relaciones=relaciones,
                padre_nombre=padre_nombre,
                id_attr_name=id_attr_name,
                id_attr_type=id_attr_type,
                is_synthetic_id=is_synthetic_id,
            )
            generated_files.append(
                GeneratedFileItem(
                    path=f"src/main/java/com/app/generated/model/{c.nombre}.java",
                    name=f"{c.nombre}.java",
                    category="model",
                    content=entity_content,
                )
            )

            # B) Repository
            repo_content = cls._generate_repository(c.nombre, id_attr_type)
            generated_files.append(
                GeneratedFileItem(
                    path=f"src/main/java/com/app/generated/repository/{c.nombre}Repository.java",
                    name=f"{c.nombre}Repository.java",
                    category="repository",
                    content=repo_content,
                )
            )

            # C) Service
            service_content = cls._generate_service(c.nombre, id_attr_type)
            generated_files.append(
                GeneratedFileItem(
                    path=f"src/main/java/com/app/generated/service/{c.nombre}Service.java",
                    name=f"{c.nombre}Service.java",
                    category="service",
                    content=service_content,
                )
            )

            # D) Controller
            controller_content = cls._generate_controller(c.nombre, id_attr_type)
            generated_files.append(
                GeneratedFileItem(
                    path=f"src/main/java/com/app/generated/controller/{c.nombre}Controller.java",
                    name=f"{c.nombre}Controller.java",
                    category="controller",
                    content=controller_content,
                )
            )

        # 6. Archivos Generales del Proyecto
        pom_content = cls._generate_pom_xml(diagrama.nombre or "backend-app")
        generated_files.append(
            GeneratedFileItem(
                path="pom.xml",
                name="pom.xml",
                category="root",
                content=pom_content,
            )
        )

        app_class_content = cls._generate_application_class()
        generated_files.append(
            GeneratedFileItem(
                path="src/main/java/com/app/generated/Application.java",
                name="Application.java",
                category="config",
                content=app_class_content,
            )
        )

        app_props_content = cls._generate_application_properties(diagrama.nombre or "classflow_backend")
        generated_files.append(
            GeneratedFileItem(
                path="src/main/resources/application.properties",
                name="application.properties",
                category="config",
                content=app_props_content,
            )
        )

        # Ordenar archivos para determinismo
        generated_files.sort(key=lambda x: x.path)

        metrics = GenerationMetrics(
            total_classes=len(clases),
            total_attributes=total_attrs,
            total_methods=total_methods,
            total_relations=len(relaciones),
            total_files=len(generated_files),
        )

        project_display_name = getattr(diagrama.proyecto, "nombre", "Proyecto ClassFlow") if diagrama.proyecto else "Proyecto ClassFlow"

        return BackendGenerateResponse(
            success=True,
            framework="Java 17 + Spring Boot 3.2 + Spring Data JPA + PostgreSQL",
            project_name=project_display_name,
            diagram_name=diagrama.nombre or "Diagrama Principal",
            package_name=BASE_PACKAGE,
            metrics=metrics,
            files=generated_files,
            summary=f"Backend Spring Boot generado exitosamente: {len(clases)} entidades, {total_attrs} atributos, {total_methods} métodos y {len(relaciones)} relaciones UML procesadas.",
        )

    @classmethod
    def generar_zip(
        cls, db: Session, diagrama_id: int, user_id: int
    ) -> Tuple[bytes, str]:
        """
        Reutiliza la generación de CU10 y empaqueta todos los artefactos en un archivo ZIP
        en memoria de forma determinista (CU11).
        Retorna una tupla (zip_bytes, filename).
        """
        # 1. Reutilizar la generación de CU10 (valida permisos, diagrama, metamodelo y genera código)
        response = cls.generar_backend(db=db, diagrama_id=diagrama_id, user_id=user_id)

        # 2. Nombre seguro para el archivo ZIP
        raw_name = response.project_name or "Proyecto"
        safe_proj = re.sub(r"[^a-zA-Z0-9_-]", "_", raw_name.strip()) or "Proyecto"
        filename = f"ClassFlow_Backend_{safe_proj}.zip"

        # 3. Empaquetado en memoria
        zip_buffer = io.BytesIO()
        root_folder = "backend-generado"

        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for file_item in response.files:
                archive_path = f"{root_folder}/{file_item.path}"
                # Fecha y hora fija (2026-01-01 00:00:00) para garantizar determinismo estricto bit a bit
                zinfo = zipfile.ZipInfo(filename=archive_path, date_time=(2026, 1, 1, 0, 0, 0))
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                zf.writestr(zinfo, file_item.content.encode("utf-8"))

        return zip_buffer.getvalue(), filename

    # =========================================================================
    # VALIDACIONES DEL MODELO
    # =========================================================================
    @classmethod
    def _validar_modelo(cls, clases: List[ClaseUML], relaciones: List[RelacionUML]) -> None:
        """Valida nombres de clases, atributos, unicidad, tipos soportados y referencias."""
        class_names_seen: Set[str] = set()
        class_ids: Set[int] = set()

        ident_pattern = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

        for c in clases:
            class_ids.add(c.id_clase)
            c_name = c.nombre.strip()

            if not ident_pattern.match(c_name):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El nombre de clase '{c_name}' no es un identificador Java válido.",
                )

            lower_name = c_name.lower()
            if lower_name in class_names_seen:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El diagrama contiene nombres de clases duplicados: '{c_name}'.",
                )
            class_names_seen.add(lower_name)

            # Validar atributos
            attr_names_seen: Set[str] = set()
            for a in c.atributos:
                a_name = a.nombre.strip()
                if not ident_pattern.match(a_name):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El nombre de atributo '{a_name}' en la clase '{c_name}' no es un identificador Java válido.",
                    )

                if a_name.lower() in attr_names_seen:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Atributo duplicado '{a_name}' en la clase '{c_name}'.",
                    )
                attr_names_seen.add(a_name.lower())

                # Validar tipo de dato soportado
                tipo_normalizado = cls._normalize_type(a.tipo_dato)
                if not tipo_normalizado:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Tipo de dato '{a.tipo_dato}' en el atributo '{a.nombre}' de la clase '{c_name}' "
                            f"no está soportado en esta fase. Tipos válidos: String, Long, Integer, Boolean, "
                            f"BigDecimal, LocalDate, LocalDateTime."
                        ),
                    )

        # Validar referencias de relaciones
        for r in relaciones:
            if r.id_clase_origen not in class_ids or r.id_clase_destino not in class_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El diagrama contiene relaciones con referencias a clases inexistentes.",
                )

    @classmethod
    def _normalize_type(cls, raw_type: Optional[str]) -> Optional[str]:
        """Normaliza tipos UML a tipos Java soportados."""
        if not raw_type:
            return None
        t = raw_type.strip().lower()
        return SUPPORTED_TYPES_MAP.get(t)

    @classmethod
    def _resolve_id_attribute(cls, clase: ClaseUML) -> Tuple[str, str, bool]:
        """
        Determina el atributo identificador.
        Si la clase UML tiene atributo 'id', lo usa (respetando si es Long o Integer).
        Si no tiene atributo 'id', genera técnicamente 'Long id'.
        Retorna (id_attr_name, id_attr_type, is_synthetic_id).
        """
        for a in clase.atributos:
            if a.nombre.strip().lower() == "id":
                norm_type = cls._normalize_type(a.tipo_dato) or "Long"
                return a.nombre.strip(), norm_type, False
        return "id", "Long", True

    # =========================================================================
    # GENERADORES DE CÓDIGO FUENTE JAVA
    # =========================================================================
    @classmethod
    def _generate_entity(
        cls,
        clase: ClaseUML,
        clases_all: List[ClaseUML],
        relaciones: List[RelacionUML],
        padre_nombre: Optional[str],
        id_attr_name: str,
        id_attr_type: str,
        is_synthetic_id: bool,
    ) -> str:
        clase_by_id = {c.id_clase: c for c in clases_all}
        table_name = _to_snake_case(clase.nombre)

        # Detectar imports necesarios
        imports: Set[str] = {
            "import jakarta.persistence.*;",
        }

        # Detectar tipos de atributos
        for a in clase.atributos:
            norm = cls._normalize_type(a.tipo_dato)
            if norm and norm in TYPE_IMPORTS:
                imports.add(TYPE_IMPORTS[norm])

        # Buscar relaciones salientes y entrantes de la clase
        outgoing_rels = [r for r in relaciones if r.id_clase_origen == clase.id_clase]
        incoming_rels = [r for r in relaciones if r.id_clase_destino == clase.id_clase]

        # Comprobar si se requiere java.util.List
        needs_list = False
        relation_fields_code: List[str] = []
        relation_methods_code: List[str] = []

        # 1. Relaciones donde esta clase es ORIGEN
        for r in outgoing_rels:
            tipo_rel = r.tipo.strip().lower()
            if tipo_rel == "herencia" or tipo_rel in ("dependencia", "realizacion"):
                continue

            target_class = clase_by_id.get(r.id_clase_destino)
            if not target_class:
                continue

            target_name = target_class.nombre
            target_field_name = _uncapitalize(target_name)
            target_field_plural = _pluralize(target_field_name)

            m_orig = (r.multiplicidad_origen or "1").strip()
            m_dest = (r.multiplicidad_destino or "1").strip()

            is_many_orig = m_orig in ("*", "0..*", "1..*")
            is_many_dest = m_dest in ("*", "0..*", "1..*")
            is_composition = tipo_rel == "composicion"

            if not is_many_orig and not is_many_dest:
                # 1:1 Origen
                relation_fields_code.append(
                    f"    @OneToOne\n"
                    f"    @JoinColumn(name = \"{_to_snake_case(target_name)}_id\")\n"
                    f"    private {target_name} {target_field_name};\n"
                )
                relation_methods_code.append(cls._make_getter_setter(target_field_name, target_name))

            elif not is_many_orig and is_many_dest:
                # 1:N Origen -> Destino
                needs_list = True
                cascade_str = "cascade = CascadeType.ALL, orphanRemoval = true" if is_composition else "cascade = CascadeType.ALL"
                mapped_by = _uncapitalize(clase.nombre)
                relation_fields_code.append(
                    f"    @OneToMany(mappedBy = \"{mapped_by}\", {cascade_str})\n"
                    f"    private List<{target_name}> {target_field_plural} = new ArrayList<>();\n"
                )
                relation_methods_code.append(cls._make_getter_setter(target_field_plural, f"List<{target_name}>"))

            elif is_many_orig and not is_many_dest:
                # N:1 Origen -> Destino
                relation_fields_code.append(
                    f"    @ManyToOne(fetch = FetchType.LAZY)\n"
                    f"    @JoinColumn(name = \"{_to_snake_case(target_name)}_id\")\n"
                    f"    private {target_name} {target_field_name};\n"
                )
                relation_methods_code.append(cls._make_getter_setter(target_field_name, target_name))

            elif is_many_orig and is_many_dest:
                # N:N Origen
                needs_list = True
                join_table = f"{table_name}_{_to_snake_case(target_name)}"
                relation_fields_code.append(
                    f"    @ManyToMany\n"
                    f"    @JoinTable(\n"
                    f"        name = \"{join_table}\",\n"
                    f"        joinColumns = @JoinColumn(name = \"{table_name}_id\"),\n"
                    f"        inverseJoinColumns = @JoinColumn(name = \"{_to_snake_case(target_name)}_id\")\n"
                    f"    )\n"
                    f"    private List<{target_name}> {target_field_plural} = new ArrayList<>();\n"
                )
                relation_methods_code.append(cls._make_getter_setter(target_field_plural, f"List<{target_name}>"))

        # 2. Relaciones donde esta clase es DESTINO
        for r in incoming_rels:
            tipo_rel = r.tipo.strip().lower()
            if tipo_rel == "herencia" or tipo_rel in ("dependencia", "realizacion"):
                continue

            orig_class = clase_by_id.get(r.id_clase_origen)
            if not orig_class:
                continue

            orig_name = orig_class.nombre
            orig_field_name = _uncapitalize(orig_name)
            orig_field_plural = _pluralize(orig_field_name)

            m_orig = (r.multiplicidad_origen or "1").strip()
            m_dest = (r.multiplicidad_destino or "1").strip()

            is_many_orig = m_orig in ("*", "0..*", "1..*")
            is_many_dest = m_dest in ("*", "0..*", "1..*")

            if not is_many_orig and not is_many_dest:
                # 1:1 Inverso
                mapped_by = _uncapitalize(clase.nombre)
                relation_fields_code.append(
                    f"    @OneToOne(mappedBy = \"{mapped_by}\")\n"
                    f"    private {orig_name} {orig_field_name};\n"
                )
                relation_methods_code.append(cls._make_getter_setter(orig_field_name, orig_name))

            elif not is_many_orig and is_many_dest:
                # 1:N Inverso (esta clase es el N)
                relation_fields_code.append(
                    f"    @ManyToOne(fetch = FetchType.LAZY)\n"
                    f"    @JoinColumn(name = \"{_to_snake_case(orig_name)}_id\")\n"
                    f"    private {orig_name} {orig_field_name};\n"
                )
                relation_methods_code.append(cls._make_getter_setter(orig_field_name, orig_name))

            elif is_many_orig and not is_many_dest:
                # N:1 Inverso (esta clase es el 1)
                needs_list = True
                mapped_by = _uncapitalize(clase.nombre)
                relation_fields_code.append(
                    f"    @OneToMany(mappedBy = \"{mapped_by}\", cascade = CascadeType.ALL)\n"
                    f"    private List<{orig_name}> {orig_field_plural} = new ArrayList<>();\n"
                )
                relation_methods_code.append(cls._make_getter_setter(orig_field_plural, f"List<{orig_name}>"))

            elif is_many_orig and is_many_dest:
                # N:N Inverso
                needs_list = True
                mapped_by = _pluralize(_uncapitalize(clase.nombre))
                relation_fields_code.append(
                    f"    @ManyToMany(mappedBy = \"{mapped_by}\")\n"
                    f"    private List<{orig_name}> {orig_field_plural} = new ArrayList<>();\n"
                )
                relation_methods_code.append(cls._make_getter_setter(orig_field_plural, f"List<{orig_name}>"))

        if needs_list:
            imports.add("import java.util.List;")
            imports.add("import java.util.ArrayList;")

        # Declaración de atributos regulares
        fields_code: List[str] = []
        methods_code: List[str] = []

        # Si no tenía ID en UML, agregar el ID sintético
        if is_synthetic_id:
            fields_code.append(
                "    @Id\n"
                "    @GeneratedValue(strategy = GenerationType.IDENTITY)\n"
                "    private Long id;\n"
            )
            methods_code.append(cls._make_getter_setter("id", "Long"))

        for a in clase.atributos:
            norm_type = cls._normalize_type(a.tipo_dato) or "String"
            is_id = a.nombre.strip().lower() == id_attr_name.lower()

            if is_id:
                fields_code.append(
                    "    @Id\n"
                    "    @GeneratedValue(strategy = GenerationType.IDENTITY)\n"
                    f"    private {norm_type} {a.nombre};\n"
                )
            else:
                col_constraints: List[str] = []
                if not a.es_nullable:
                    col_constraints.append("nullable = false")

                col_annot = f"    @Column({', '.join(col_constraints)})\n" if col_constraints else ""
                fields_code.append(f"{col_annot}    private {norm_type} {a.nombre};\n")

            methods_code.append(cls._make_getter_setter(a.nombre, norm_type))

        # Métodos de negocio UML declarados
        business_methods_code: List[str] = []
        for m in clase.metodos:
            m_ret = cls._normalize_type(m.tipo_retorno) or ("void" if (m.tipo_retorno or "").strip().lower() == "void" else "void")
            params_list: List[str] = []
            for p in m.parametros:
                p_type = cls._normalize_type(p.tipo_dato) or "String"
                params_list.append(f"{p_type} {p.nombre}")

            params_str = ", ".join(params_list)
            business_methods_code.append(
                f"    public {m_ret} {m.nombre}({params_str}) {{\n"
                f"        // Método definido en Diagrama UML ClassFlow AI\n"
                f"        throw new UnsupportedOperationException(\"Método '{m.nombre}' no implementado.\");\n"
                f"    }}\n"
            )

        # Construir código de la clase
        extends_clause = f" extends {padre_nombre}" if padre_nombre else ""
        sorted_imports = "\n".join(sorted(imports))

        fields_block = "\n".join(fields_code)
        relation_fields_block = "\n".join(relation_fields_code)
        methods_block = "\n".join(methods_code)
        relation_methods_block = "\n".join(relation_methods_code)
        business_block = "\n".join(business_methods_code)

        entity_template = f"""package {BASE_PACKAGE}.model;

{sorted_imports}

@Entity
@Table(name = "{table_name}")
public class {clase.nombre}{extends_clause} {{

{fields_block}
{relation_fields_block}
    public {clase.nombre}() {{
    }}

{methods_block}
{relation_methods_block}
{business_block}
}}
"""
        return entity_template.strip() + "\n"

    @classmethod
    def _make_getter_setter(cls, field_name: str, field_type: str) -> str:
        cap = _capitalize(field_name)
        return (
            f"    public {field_type} get{cap}() {{\n"
            f"        return this.{field_name};\n"
            f"    }}\n\n"
            f"    public void set{cap}({field_type} {field_name}) {{\n"
            f"        this.{field_name} = {field_name};\n"
            f"    }}\n"
        )

    @classmethod
    def _generate_repository(cls, class_name: str, id_type: str) -> str:
        return f"""package {BASE_PACKAGE}.repository;

import {BASE_PACKAGE}.model.{class_name};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {class_name}Repository extends JpaRepository<{class_name}, {id_type}> {{
}}
"""

    @classmethod
    def _generate_service(cls, class_name: str, id_type: str) -> str:
        var_name = _uncapitalize(class_name)
        return f"""package {BASE_PACKAGE}.service;

import {BASE_PACKAGE}.model.{class_name};
import {BASE_PACKAGE}.repository.{class_name}Repository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class {class_name}Service {{

    private final {class_name}Repository repository;

    public {class_name}Service({class_name}Repository repository) {{
        this.repository = repository;
    }}

    @Transactional(readOnly = true)
    public List<{class_name}> findAll() {{
        return repository.findAll();
    }}

    @Transactional(readOnly = true)
    public Optional<{class_name}> findById({id_type} id) {{
        return repository.findById(id);
    }}

    public {class_name} save({class_name} {var_name}) {{
        return repository.save({var_name});
    }}

    public void deleteById({id_type} id) {{
        repository.deleteById(id);
    }}
}}
"""

    @classmethod
    def _generate_controller(cls, class_name: str, id_type: str) -> str:
        var_name = _uncapitalize(class_name)
        plural_path = _pluralize(_to_snake_case(class_name))

        return f"""package {BASE_PACKAGE}.controller;

import {BASE_PACKAGE}.model.{class_name};
import {BASE_PACKAGE}.service.{class_name}Service;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{plural_path}")
public class {class_name}Controller {{

    private final {class_name}Service service;

    public {class_name}Controller({class_name}Service service) {{
        this.service = service;
    }}

    @GetMapping
    public List<{class_name}> getAll() {{
        return service.findAll();
    }}

    @GetMapping("/{{id}}")
    public ResponseEntity<{class_name}> getById(@PathVariable {id_type} id) {{
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public {class_name} create(@RequestBody {class_name} {var_name}) {{
        return service.save({var_name});
    }}

    @DeleteMapping("/{{id}}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable {id_type} id) {{
        service.deleteById(id);
    }}
}}
"""

    @classmethod
    def _generate_pom_xml(cls, project_name: str) -> str:
        artifact_id = re.sub(r"[^a-zA-Z0-9_-]", "-", project_name.lower().strip()) or "backend-app"
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.3</version>
        <relativePath/>
    </parent>

    <groupId>com.app.generated</groupId>
    <artifactId>{artifact_id}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>{project_name}</name>
    <description>Backend generado deterministamente por ClassFlow AI</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <!-- PostgreSQL Driver -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
"""

    @classmethod
    def _generate_application_class(cls) -> str:
        return f"""package {BASE_PACKAGE};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {{

    public static void main(String[] args) {{
        SpringApplication.run(Application.class, args);
    }}
}}
"""

    @classmethod
    def _generate_application_properties(cls, db_name: str) -> str:
        safe_db = re.sub(r"[^a-zA-Z0-9_]", "_", db_name.lower().strip()) or "classflow_db"
        return f"""# ===================================================================
# CONFIGURACIÓN GENERADA POR CLASSFLOW AI (JAVA 17 + SPRING BOOT 3.2)
# ===================================================================
spring.application.name={safe_db}
server.port=8080

# Conexión PostgreSQL
spring.datasource.url=jdbc:postgresql://localhost:5432/{safe_db}
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# Configuración Hibernate / JPA
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
"""
