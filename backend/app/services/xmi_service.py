import os
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.diagrama import Diagrama
from app.models.uml import ClaseUML, AtributoUML, MetodoUML, ParametroUML, RelacionUML
from app.services.diagrama_service import DiagramaService

ALLOWED_XMI_EXTENSIONS = {".xmi", ".xml"}
MAX_XMI_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Namespaces estándar OMG XMI 2.1 y UML 2.1
XMI_NS = "http://schema.omg.org/spec/XMI/2.1"
UML_NS = "http://schema.omg.org/spec/UML/2.1"


def _clean_str(val: Optional[str]) -> str:
    return (val or "").strip()


def _format_mult_for_xml(mult: Optional[str]) -> Tuple[str, str]:
    """Convierte multiplicidad en cadena a valores lower y upper para XMI estándar."""
    m = _clean_str(mult)
    if not m or m == "1":
        return "1", "1"
    if m == "0..1":
        return "0", "1"
    if m in ("0..*", "*"):
        return "0", "*"
    if m == "1..*":
        return "1", "*"
    if ".." in m:
        parts = m.split("..", 1)
        return parts[0].strip(), parts[1].strip()
    return m, m


def _parse_mult_from_values(lower: Optional[str], upper: Optional[str], fallback: Optional[str] = None) -> str:
    """Reconstruye la cadena de multiplicidad a partir de lower y upper."""
    if fallback:
        return fallback.strip()
    l_str = _clean_str(lower) or "1"
    u_str = _clean_str(upper) or "1"
    if l_str == u_str:
        return l_str
    if l_str == "0" and u_str == "*":
        return "0..*"
    if l_str == "1" and u_str == "*":
        return "1..*"
    if l_str == "0" and u_str == "1":
        return "0..1"
    return f"{l_str}..{u_str}"


def _get_xmi_type(elem: ET.Element) -> Optional[str]:
    """Retorna el tipo XMI del elemento (xmi:type o {namespace}type)."""
    for k in (f"{{{XMI_NS}}}type", "xmi:type"):
        if k in elem.attrib:
            return elem.attrib[k]
    for k, v in elem.attrib.items():
        if k.endswith("}type") or k.endswith(":type"):
            return v
    return None


def _get_xmi_id(elem: ET.Element) -> Optional[str]:
    """Retorna el identificador XMI del elemento."""
    for k in (f"{{{XMI_NS}}}id", "xmi:id"):
        if k in elem.attrib:
            return elem.attrib[k]
    for k, v in elem.attrib.items():
        if k.endswith("}id") or k.endswith(":id"):
            return v
    return elem.attrib.get("id")


def _get_xmi_idref(elem: ET.Element) -> Optional[str]:
    """Retorna una referencia xmi:idref o idref."""
    for k in (f"{{{XMI_NS}}}idref", "xmi:idref", "idref"):
        if k in elem.attrib:
            return elem.attrib[k]
    for k, v in elem.attrib.items():
        if k.endswith("}idref") or k.endswith(":idref"):
            return v
    return None


def _get_attr(elem: ET.Element, name: str) -> Optional[str]:
    """Busca un atributo exacto primero; si no existe, busca sin namespace asegurando no colisionar con metadatos XMI."""
    if name in elem.attrib:
        return elem.attrib[name]
    for k, v in elem.attrib.items():
        if k.endswith(f"}}{name}") or k.endswith(f":{name}"):
            if not ("xmi" in k.lower() and name in ("type", "id")):
                return v
    return None


def _get_type_ref(elem: ET.Element) -> Optional[str]:
    """Obtiene la referencia de tipo de un ownedAttribute o ownedEnd."""
    # 1. Atributo directo 'type' que no sea xmi:type
    if "type" in elem.attrib:
        return elem.attrib["type"]
    # 2. Sub-elemento <type>
    for child in elem:
        if _local_tag(child) == "type":
            t_id = _get_xmi_idref(child) or child.attrib.get("name") or child.attrib.get("type")
            if t_id:
                return t_id
    return None


def _local_tag(elem: ET.Element) -> str:
    """Retorna la etiqueta local del elemento sin namespace."""
    tag = elem.tag
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


class XMIService:
    """
    Servicio de interoperabilidad XMI 2.1 / UML 2.1 para Diagramas de Clases (CU08 y CU09).
    Diseñado para interoperabilidad con herramientas CASE como Enterprise Architect.
    """

    # =========================================================================
    # CU09: EXPORTAR DIAGRAMA UML A XMI
    # =========================================================================
    @classmethod
    def exportar_diagrama(cls, db: Session, diagrama_id: int, user_id: int) -> str:
        """
        Genera un documento XML XMI 2.1 estándar que representa el diagrama de clases actual.
        Solo accesible por el propietario del proyecto.
        """
        # 1. Autorización: SOLO PROPIETARIO
        _, es_propietario, _ = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=False
        )
        if not es_propietario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del proyecto puede exportar diagramas UML.",
            )

        diagrama = db.query(Diagrama).filter(Diagrama.id_diagrama == diagrama_id).first()
        if not diagrama:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagrama no encontrado.")

        clases = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).order_by(ClaseUML.id_clase).all()
        relaciones = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).order_by(RelacionUML.id_relacion).all()

        # Configurar elemento raíz XMI
        ET.register_namespace("xmi", XMI_NS)
        ET.register_namespace("uml", UML_NS)

        root = ET.Element(f"{{{XMI_NS}}}XMI", {f"{{{XMI_NS}}}version": "2.1"})
        model = ET.SubElement(
            root,
            f"{{{UML_NS}}}Model",
            {
                f"{{{XMI_NS}}}type": "uml:Model",
                f"{{{XMI_NS}}}id": f"model_{diagrama.id_diagrama}",
                "name": diagrama.nombre or "ClassFlowModel",
            },
        )

        # Mapear herencias para incluirlas dentro de la clase hija
        herencias_por_hija: Dict[int, List[RelacionUML]] = {}
        otras_relaciones: List[RelacionUML] = []

        for r in relaciones:
            if r.tipo.strip().lower() == "herencia":
                herencias_por_hija.setdefault(r.id_clase_origen, []).append(r)
            else:
                otras_relaciones.append(r)

        # 2. Generar clases
        for c in clases:
            c_elem = ET.SubElement(
                model,
                "packagedElement",
                {
                    f"{{{XMI_NS}}}type": "uml:Class",
                    f"{{{XMI_NS}}}id": f"class_{c.id_clase}",
                    "name": c.nombre,
                    "visibility": c.visibilidad or "public",
                    "isAbstract": "true" if c.es_abstracta else "false",
                },
            )
            if c.estereotipo:
                c_elem.set("stereotype", c.estereotipo)

            # Atributos de la clase
            for a in c.atributos:
                a_elem = ET.SubElement(
                    c_elem,
                    "ownedAttribute",
                    {
                        f"{{{XMI_NS}}}type": "uml:Property",
                        f"{{{XMI_NS}}}id": f"attr_{a.id_atributo}",
                        "name": a.nombre,
                        "visibility": a.visibilidad or "private",
                        "isStatic": "true" if a.es_estatico else "false",
                        "isReadOnly": "true" if a.es_final else "false",
                    },
                )
                # Tipo primitivo / referencia
                ET.SubElement(
                    a_elem,
                    "type",
                    {
                        f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                        "name": a.tipo_dato or "String",
                    },
                )
                if a.valor_defecto:
                    ET.SubElement(
                        a_elem,
                        "defaultValue",
                        {
                            f"{{{XMI_NS}}}type": "uml:LiteralString",
                            "value": a.valor_defecto,
                        },
                    )
                if a.es_nullable:
                    ET.SubElement(
                        a_elem,
                        "lowerValue",
                        {
                            f"{{{XMI_NS}}}type": "uml:LiteralInteger",
                            "value": "0",
                        },
                    )

            # Métodos y parámetros de la clase
            for m in c.metodos:
                m_elem = ET.SubElement(
                    c_elem,
                    "ownedOperation",
                    {
                        f"{{{XMI_NS}}}type": "uml:Operation",
                        f"{{{XMI_NS}}}id": f"op_{m.id_metodo}",
                        "name": m.nombre,
                        "visibility": m.visibilidad or "public",
                        "isStatic": "true" if m.es_estatico else "false",
                        "isAbstract": "true" if m.es_abstracto else "false",
                    },
                )

                # Parámetros regulares
                for p in m.parametros:
                    p_elem = ET.SubElement(
                        m_elem,
                        "ownedParameter",
                        {
                            f"{{{XMI_NS}}}type": "uml:Parameter",
                            f"{{{XMI_NS}}}id": f"param_{p.id_parametro}",
                            "name": p.nombre,
                        },
                    )
                    ET.SubElement(
                        p_elem,
                        "type",
                        {
                            f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                            "name": p.tipo_dato or "String",
                        },
                    )
                    if p.valor_defecto:
                        ET.SubElement(
                            p_elem,
                            "defaultValue",
                            {
                                f"{{{XMI_NS}}}type": "uml:LiteralString",
                                "value": p.valor_defecto,
                            },
                        )

                # Parámetro especial de RETORNO (UML estándar: direction="return")
                ret_elem = ET.SubElement(
                    m_elem,
                    "ownedParameter",
                    {
                        f"{{{XMI_NS}}}type": "uml:Parameter",
                        f"{{{XMI_NS}}}id": f"ret_{m.id_metodo}",
                        "name": "return",
                        "direction": "return",
                    },
                )
                ET.SubElement(
                    ret_elem,
                    "type",
                    {
                        f"{{{XMI_NS}}}type": "uml:PrimitiveType",
                        "name": m.tipo_retorno or "void",
                    },
                )

            # Herencia (Generalización): hija -> padre
            for h in herencias_por_hija.get(c.id_clase, []):
                ET.SubElement(
                    c_elem,
                    "generalization",
                    {
                        f"{{{XMI_NS}}}type": "uml:Generalization",
                        f"{{{XMI_NS}}}id": f"gen_{h.id_relacion}",
                        "general": f"class_{h.id_clase_destino}",
                    },
                )

        # 3. Generar relaciones fuera de las clases (Asociaciones, Agregaciones, Composiciones, Dependencias, Realizaciones)
        for rel in otras_relaciones:
            t = rel.tipo.strip().lower()

            if t == "dependencia":
                d_elem = ET.SubElement(
                    model,
                    "packagedElement",
                    {
                        f"{{{XMI_NS}}}type": "uml:Dependency",
                        f"{{{XMI_NS}}}id": f"dep_{rel.id_relacion}",
                        "client": f"class_{rel.id_clase_origen}",
                        "supplier": f"class_{rel.id_clase_destino}",
                    },
                )
                if rel.nombre:
                    d_elem.set("name", rel.nombre)

            elif t == "realizacion":
                r_elem = ET.SubElement(
                    model,
                    "packagedElement",
                    {
                        f"{{{XMI_NS}}}type": "uml:Realization",
                        f"{{{XMI_NS}}}id": f"real_{rel.id_relacion}",
                        "client": f"class_{rel.id_clase_origen}",
                        "supplier": f"class_{rel.id_clase_destino}",
                    },
                )
                if rel.nombre:
                    r_elem.set("name", rel.nombre)

            else:
                # asociacion, agregacion, composicion
                agg_type = "none"
                if t == "agregacion":
                    agg_type = "shared"
                elif t == "composicion":
                    agg_type = "composite"

                assoc_elem = ET.SubElement(
                    model,
                    "packagedElement",
                    {
                        f"{{{XMI_NS}}}type": "uml:Association",
                        f"{{{XMI_NS}}}id": f"assoc_{rel.id_relacion}",
                    },
                )
                if rel.nombre:
                    assoc_elem.set("name", rel.nombre)

                orig_id_ref = f"end_orig_{rel.id_relacion}"
                dest_id_ref = f"end_dest_{rel.id_relacion}"

                ET.SubElement(assoc_elem, "memberEnd", {f"{{{XMI_NS}}}idref": orig_id_ref})
                ET.SubElement(assoc_elem, "memberEnd", {f"{{{XMI_NS}}}idref": dest_id_ref})

                # Extremo Origen
                l_orig, u_orig = _format_mult_for_xml(rel.multiplicidad_origen)
                end_orig = ET.SubElement(
                    assoc_elem,
                    "ownedEnd",
                    {
                        f"{{{XMI_NS}}}type": "uml:Property",
                        f"{{{XMI_NS}}}id": orig_id_ref,
                        "type": f"class_{rel.id_clase_origen}",
                        "multiplicity": rel.multiplicidad_origen or "1",
                    },
                )
                if rel.rol_origen:
                    end_orig.set("name", rel.rol_origen)
                ET.SubElement(end_orig, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralString", "value": l_orig})
                ET.SubElement(end_orig, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralString", "value": u_orig})

                # Extremo Destino
                l_dest, u_dest = _format_mult_for_xml(rel.multiplicidad_destino)
                end_dest = ET.SubElement(
                    assoc_elem,
                    "ownedEnd",
                    {
                        f"{{{XMI_NS}}}type": "uml:Property",
                        f"{{{XMI_NS}}}id": dest_id_ref,
                        "type": f"class_{rel.id_clase_destino}",
                        "aggregation": agg_type,
                        "multiplicity": rel.multiplicidad_destino or "1",
                    },
                )
                if rel.rol_destino:
                    end_dest.set("name", rel.rol_destino)
                ET.SubElement(end_dest, "lowerValue", {f"{{{XMI_NS}}}type": "uml:LiteralString", "value": l_dest})
                ET.SubElement(end_dest, "upperValue", {f"{{{XMI_NS}}}type": "uml:LiteralString", "value": u_dest})

        # Formatear e indentar XML
        ET.indent(root, space="  ")
        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        return xml_bytes.decode("utf-8")

    # =========================================================================
    # CU08: IMPORTAR DIAGRAMA UML DESDE XMI
    # =========================================================================
    @classmethod
    def importar_diagrama(
        cls, db: Session, diagrama_id: int, user_id: int, file: UploadFile
    ) -> Dict[str, Any]:
        """
        Importa un diagrama de clases UML a partir de un archivo XMI/XML estándar.
        Reglas estrictas:
        - Solo accesible por el propietario (403 a invitados).
        - Solo opera sobre un diagrama VACÍO (400 si ya contiene clases o relaciones).
        - Parsear primero, validar todo, persistir atómicamente después.
        - diagram.changed se emite únicamente tras el commit exitoso.
        """
        # 1. Autorización: SOLO PROPIETARIO
        _, es_propietario, _ = DiagramaService.get_diagrama_permiso(
            db, diagrama_id, user_id, require_edit=True
        )
        if not es_propietario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario del proyecto puede importar diagramas UML.",
            )

        # 2. Validación de archivo (extensión, tamaño y contenido)
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_XMI_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extensión de archivo '{ext}' no permitida. Se admiten únicamente archivos .xmi o .xml.",
            )

        try:
            raw_bytes = file.file.read()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo leer el archivo: {str(exc)}",
            )

        if not raw_bytes or len(raw_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo proporcionado está vacío.",
            )

        if len(raw_bytes) > MAX_XMI_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El tamaño del archivo ({len(raw_bytes) // 1024} KB) supera el límite máximo permitido de 10 MB.",
            )

        # 3. Seguridad XML: Bloqueo de DOCTYPE y ENTITY (Defensa XXE)
        raw_lower = raw_bytes.lower()
        if b"<!doctype" in raw_lower or b"<!entity" in raw_lower:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo XML contiene declaraciones DOCTYPE o ENTITY no permitidas por seguridad.",
            )

        # 4. Parsing sintáctico del XML
        try:
            root = ET.fromstring(raw_bytes)
        except ET.ParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo XML está malformado: {str(exc)}",
            )

        # 5. Precondición fundamental: El diagrama destino debe estar VACÍO
        existing_classes_count = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).count()
        existing_relations_count = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).count()
        if existing_classes_count > 0 or existing_relations_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El diagrama debe estar vacío antes de importar un archivo XMI.",
            )

        # 6. Extracción semántica del metamodelo UML
        parsed_classes: List[Dict[str, Any]] = []
        parsed_relations: List[Dict[str, Any]] = []
        xmi_id_to_class_name: Dict[str, str] = {}
        class_names_seen: set = set()

        # Recorrer todos los elementos del árbol XML
        for elem in root.iter():
            tag = _local_tag(elem)
            xmi_type = (_get_xmi_type(elem) or "").strip()
            xmi_id = (_get_xmi_id(elem) or "").strip()

            # DETECTAR CLASES UML
            is_class = (
                tag == "Class"
                or (tag == "packagedElement" and (xmi_type in ("uml:Class", "Class") or xmi_type.endswith(":Class")))
            )

            if is_class:
                name = (_get_attr(elem, "name") or "").strip()
                if not name:
                    continue

                if name.lower() in class_names_seen:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El archivo XMI contiene nombres de clases duplicados: '{name}'.",
                    )
                class_names_seen.add(name.lower())

                if xmi_id:
                    xmi_id_to_class_name[xmi_id] = name

                visibility = (_get_attr(elem, "visibility") or "public").strip()
                is_abstract = (_get_attr(elem, "isAbstract") or "false").strip().lower() in ("true", "1")
                stereotype = _get_attr(elem, "stereotype")

                # Extraer atributos, métodos y herencias dentro de la clase
                atributos: List[Dict[str, Any]] = []
                metodos: List[Dict[str, Any]] = []

                for child in elem:
                    c_tag = _local_tag(child)
                    c_type = (_get_xmi_type(child) or "").strip()

                    # A) ATRIBUTO
                    if c_tag == "ownedAttribute" or c_type in ("uml:Property", "Property"):
                        a_name = (_get_attr(child, "name") or "").strip()
                        if a_name:
                            a_vis = (_get_attr(child, "visibility") or "private").strip()
                            a_static = (_get_attr(child, "isStatic") or "false").lower() in ("true", "1")
                            a_final = (_get_attr(child, "isReadOnly") or "false").lower() in ("true", "1")

                            # Obtener tipo de dato
                            a_type_val = "String"
                            type_child = child.find("type")
                            if type_child is not None:
                                a_type_val = _get_attr(type_child, "name") or a_type_val
                            elif _get_attr(child, "type"):
                                t_attr = _get_attr(child, "type")
                                if t_attr and not t_attr.startswith("uml:"):
                                    a_type_val = t_attr

                            # Nullable
                            lower_child = child.find("lowerValue")
                            is_nullable = True
                            if lower_child is not None:
                                val = _get_attr(lower_child, "value")
                                is_nullable = val == "0"

                            # Valor defecto
                            def_child = child.find("defaultValue")
                            def_val = _get_attr(def_child, "value") if def_child is not None else None

                            atributos.append({
                                "nombre": a_name,
                                "tipo_dato": a_type_val,
                                "visibilidad": a_vis,
                                "es_estatico": a_static,
                                "es_final": a_final,
                                "es_nullable": is_nullable,
                                "valor_defecto": def_val,
                            })

                    # B) MÉTODO (Operación)
                    elif c_tag == "ownedOperation" or c_type in ("uml:Operation", "Operation"):
                        m_name = (_get_attr(child, "name") or "").strip()
                        if m_name:
                            m_vis = (_get_attr(child, "visibility") or "public").strip()
                            m_static = (_get_attr(child, "isStatic") or "false").lower() in ("true", "1")
                            m_abstract = (_get_attr(child, "isAbstract") or "false").lower() in ("true", "1")

                            m_return_type = "void"
                            parametros: List[Dict[str, Any]] = []

                            for p_child in child:
                                p_tag = _local_tag(p_child)
                                if p_tag == "ownedParameter":
                                    p_dir = (_get_attr(p_child, "direction") or "").lower()

                                    # Tipo de dato del parámetro
                                    p_type_val = "String"
                                    p_type_elem = p_child.find("type")
                                    if p_type_elem is not None:
                                        p_type_val = _get_attr(p_type_elem, "name") or p_type_val
                                    elif _get_attr(p_child, "type"):
                                        p_type_val = _get_attr(p_child, "type") or p_type_val

                                    if p_dir == "return":
                                        # REGLA OBLIGATORIA: direction="return" reconstruye MetodoUML.tipo_retorno
                                        m_return_type = p_type_val or "void"
                                    else:
                                        p_name = (_get_attr(p_child, "name") or "").strip()
                                        if p_name:
                                            p_def = None
                                            p_def_elem = p_child.find("defaultValue")
                                            if p_def_elem is not None:
                                                p_def = _get_attr(p_def_elem, "value")
                                            parametros.append({
                                                "nombre": p_name,
                                                "tipo_dato": p_type_val,
                                                "valor_defecto": p_def,
                                            })

                            metodos.append({
                                "nombre": m_name,
                                "tipo_retorno": m_return_type,
                                "visibilidad": m_vis,
                                "es_estatico": m_static,
                                "es_abstracto": m_abstract,
                                "parametros": parametros,
                            })

                    # C) GENERALIZACIÓN (Herencia: hija -> padre)
                    elif c_tag == "generalization" or c_type in ("uml:Generalization", "Generalization"):
                        general_ref = _get_attr(child, "general")
                        if not general_ref:
                            gen_elem = child.find("general")
                            if gen_elem is not None:
                                general_ref = _get_attr(gen_elem, "idref")

                        if general_ref:
                            parsed_relations.append({
                                "tipo": "herencia",
                                "origen_ref": xmi_id or name,
                                "destino_ref": general_ref,
                                "nombre": None,
                                "multiplicidad_origen": "1",
                                "multiplicidad_destino": "1",
                            })

                parsed_classes.append({
                    "xmi_id": xmi_id or name,
                    "nombre": name,
                    "estereotipo": stereotype,
                    "visibilidad": visibility,
                    "es_abstracta": is_abstract,
                    "atributos": atributos,
                    "metodos": metodos,
                })

            # DETECTAR RELACIONES EXTERNAS (Asociación, Agregación, Composición, Dependencia, Realización)
            is_assoc = tag == "packagedElement" and (xmi_type in ("uml:Association", "Association") or xmi_type.endswith(":Association"))
            is_dep = tag == "packagedElement" and (xmi_type in ("uml:Dependency", "Dependency") or xmi_type.endswith(":Dependency"))
            is_real = tag == "packagedElement" and (xmi_type in ("uml:Realization", "Realization") or xmi_type.endswith(":Realization"))

            if is_dep or is_real:
                # Regla de dirección: client (origen) -> supplier (destino)
                client_ref = _get_attr(elem, "client")
                supplier_ref = _get_attr(elem, "supplier")
                rel_name = _get_attr(elem, "name")
                rel_kind = "dependencia" if is_dep else "realizacion"

                if client_ref and supplier_ref:
                    parsed_relations.append({
                        "tipo": rel_kind,
                        "origen_ref": client_ref,
                        "destino_ref": supplier_ref,
                        "nombre": rel_name,
                        "multiplicidad_origen": "1",
                        "multiplicidad_destino": "1",
                    })

            elif is_assoc:
                # Asociación / Agregación / Composición
                rel_name = _get_attr(elem, "name")
                ends: List[ET.Element] = [c for c in elem if _local_tag(c) == "ownedEnd"]

                if len(ends) >= 2:
                    end1, end2 = ends[0], ends[1]
                    t1 = _get_type_ref(end1)
                    t2 = _get_type_ref(end2)

                    agg1 = (_get_attr(end1, "aggregation") or "none").lower()
                    agg2 = (_get_attr(end2, "aggregation") or "none").lower()

                    kind = "asociacion"
                    if agg2 in ("shared", "aggregate"):
                        kind = "agregacion"
                    elif agg2 == "composite":
                        kind = "composicion"
                    elif agg1 in ("shared", "aggregate"):
                        kind = "agregacion"
                    elif agg1 == "composite":
                        kind = "composicion"

                    # Multiplicidades
                    m1_raw = _get_attr(end1, "multiplicity")
                    m2_raw = _get_attr(end2, "multiplicity")

                    l1_elem = end1.find("lowerValue")
                    u1_elem = end1.find("upperValue")
                    l1 = _get_attr(l1_elem, "value") if l1_elem is not None else None
                    u1 = _get_attr(u1_elem, "value") if u1_elem is not None else None
                    mult1 = _parse_mult_from_values(l1, u1, m1_raw)

                    l2_elem = end2.find("lowerValue")
                    u2_elem = end2.find("upperValue")
                    l2 = _get_attr(l2_elem, "value") if l2_elem is not None else None
                    u2 = _get_attr(u2_elem, "value") if u2_elem is not None else None
                    mult2 = _parse_mult_from_values(l2, u2, m2_raw)

                    if t1 and t2:
                        parsed_relations.append({
                            "tipo": kind,
                            "origen_ref": t1,
                            "destino_ref": t2,
                            "nombre": rel_name,
                            "multiplicidad_origen": mult1,
                            "multiplicidad_destino": mult2,
                        })

        # 7. Validar que se encontró un modelo UML reconocible
        if not parsed_classes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo XML no contiene un modelo UML de clases reconocible.",
            )

        # 8. Mapear y validar referencias de relaciones a clases
        valid_refs = set(xmi_id_to_class_name.keys()) | {c["nombre"] for c in parsed_classes}

        for r in parsed_relations:
            o_ref = r["origen_ref"]
            d_ref = r["destino_ref"]

            # Resolver nombres reales
            o_name = xmi_id_to_class_name.get(o_ref, o_ref)
            d_name = xmi_id_to_class_name.get(d_ref, d_ref)

            if o_ref not in valid_refs and o_name not in class_names_seen:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El archivo XMI contiene una relación con referencia inválida al origen: '{o_ref}'.",
                )
            if d_ref not in valid_refs and d_name not in class_names_seen:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El archivo XMI contiene una relación con referencia inválida al destino: '{d_ref}'.",
                )

            r["origen_nombre"] = o_name
            r["destino_nombre"] = d_name

        # 9. Persistencia atómica en PostgreSQL con posiciones automáticas en rejilla
        created_classes_names: List[str] = []
        name_to_db_id: Dict[str, int] = {}
        created_relations_count = 0

        try:
            # Insertar Clases
            for idx, c_data in enumerate(parsed_classes):
                col = idx % 3
                row = idx // 3
                pos_x = 80 + col * 320
                pos_y = 80 + row * 260

                db_clase = ClaseUML(
                    id_diagrama=diagrama_id,
                    nombre=c_data["nombre"],
                    estereotipo=c_data["estereotipo"] or "«entity»",
                    visibilidad=c_data["visibilidad"] or "public",
                    es_abstracta=c_data["es_abstracta"],
                    posicion_x=pos_x,
                    posicion_y=pos_y,
                    ancho=260,
                    alto=180,
                )
                db.add(db_clase)
                db.flush()

                name_to_db_id[db_clase.nombre.lower()] = db_clase.id_clase
                created_classes_names.append(db_clase.nombre)

                # Insertar Atributos
                for ord_a, a_data in enumerate(c_data["atributos"]):
                    db_attr = AtributoUML(
                        id_clase=db_clase.id_clase,
                        nombre=a_data["nombre"],
                        tipo_dato=a_data["tipo_dato"] or "String",
                        visibilidad=a_data["visibilidad"] or "private",
                        valor_defecto=a_data["valor_defecto"],
                        es_estatico=a_data["es_estatico"],
                        es_final=a_data["es_final"],
                        es_nullable=a_data["es_nullable"],
                        orden=ord_a,
                    )
                    db.add(db_attr)

                # Insertar Métodos y Parámetros
                for ord_m, m_data in enumerate(c_data["metodos"]):
                    db_met = MetodoUML(
                        id_clase=db_clase.id_clase,
                        nombre=m_data["nombre"],
                        tipo_retorno=m_data["tipo_retorno"] or "void",
                        visibilidad=m_data["visibilidad"] or "public",
                        es_estatico=m_data["es_estatico"],
                        es_abstracto=m_data["es_abstracto"],
                        orden=ord_m,
                    )
                    db.add(db_met)
                    db.flush()

                    for ord_p, p_data in enumerate(m_data["parametros"]):
                        db_param = ParametroUML(
                            id_metodo=db_met.id_metodo,
                            nombre=p_data["nombre"],
                            tipo_dato=p_data["tipo_dato"] or "String",
                            valor_defecto=p_data["valor_defecto"],
                            orden=ord_p,
                        )
                        db.add(db_param)

            # Insertar Relaciones
            for r_data in parsed_relations:
                orig_id = name_to_db_id.get(r_data["origen_nombre"].lower())
                dest_id = name_to_db_id.get(r_data["destino_nombre"].lower())

                if not orig_id or not dest_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Fallo en la resolución de IDs para persistir relaciones.",
                    )

                db_rel = RelacionUML(
                    id_diagrama=diagrama_id,
                    id_clase_origen=orig_id,
                    id_clase_destino=dest_id,
                    tipo=r_data["tipo"],
                    nombre=r_data["nombre"],
                    multiplicidad_origen=r_data["multiplicidad_origen"] or "1",
                    multiplicidad_destino=r_data["multiplicidad_destino"] or "1",
                    navegabilidad_origen=False,
                    navegabilidad_destino=True,
                )
                db.add(db_rel)
                created_relations_count += 1

            # Commit atómico
            db.commit()

        except Exception as exc:
            db.rollback()
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Fallo durante la persistencia del archivo XMI: {str(exc)}",
            )

        # 10. Notificación WebSocket diagram.changed (SOLO después del commit exitoso)
        DiagramaService._notify_diagram_changed(diagrama_id, user_id)

        total_classes = db.query(ClaseUML).filter(ClaseUML.id_diagrama == diagrama_id).count()
        total_relations = db.query(RelacionUML).filter(RelacionUML.id_diagrama == diagrama_id).count()

        return {
            "success": True,
            "message": f"Diagrama XMI importado exitosamente: {len(created_classes_names)} clases y {created_relations_count} relaciones.",
            "total_classes": total_classes,
            "total_relations": total_relations,
            "created_classes": created_classes_names,
        }
