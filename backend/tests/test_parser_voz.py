import pytest
from fastapi import HTTPException

from app.services.voice_parser import DeterministicVoiceParser


def test_parser_add_class_factura():
    res = DeterministicVoiceParser.parse("Agrega una clase Factura")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "Factura"
    assert res["data"]["visibilidad"] == "public"


def test_parser_add_class_factura_voz_con_punto():
    res = DeterministicVoiceParser.parse("Agrega una clase FacturaVoz.")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "FacturaVoz"


def test_parser_add_class_compuesta_factura_voz_con_espacios():
    # El navegador transcribe con espacios separados: "factura voz"
    res = DeterministicVoiceParser.parse("Agrega una clase factura voz")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "FacturaVoz"


def test_parser_add_class_compuesta_detalle_venta():
    res = DeterministicVoiceParser.parse("Agrega una clase detalle venta")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "DetalleVenta"


def test_parser_add_class_compuesta_orden_de_compra():
    res = DeterministicVoiceParser.parse("Agrega una clase orden de compra")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "OrdenDeCompra"


def test_parser_add_class_mascota():
    res = DeterministicVoiceParser.parse("Agrega una clase Mascota")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "Mascota"


def test_parser_crea_clase_orden_de_compra():
    res = DeterministicVoiceParser.parse("Crea una clase orden de compra.")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "OrdenDeCompra"


def test_parser_crear_clase_detalle_venta():
    res = DeterministicVoiceParser.parse("Crear clase detalle venta")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "DetalleVenta"


def test_parser_add_class_mayusculas_factura_voz():
    res = DeterministicVoiceParser.parse("agrega una clase FACTURA VOZ")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "FacturaVoz"


def test_parser_crea_clase_pedido():
    res = DeterministicVoiceParser.parse("Crea una clase Pedido")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "Pedido"


def test_parser_crear_clase_cliente():
    res = DeterministicVoiceParser.parse("Crear clase Cliente")
    assert res["operation"] == "add_class"
    assert res["data"]["nombre"] == "Cliente"


def test_parser_nombre_extraido_literal_sin_alucinaciones():
    # Si el usuario dice FacturaVoz, NUNCA debe devolver Pedido, Cliente ni Producto
    res = DeterministicVoiceParser.parse("Agrega una clase FacturaVoz")
    assert res["data"]["nombre"] == "FacturaVoz"
    assert res["data"]["nombre"] not in ["Pedido", "Cliente", "Producto"]


def test_parser_add_attribute_oficial():
    res = DeterministicVoiceParser.parse("Agrega un atributo correo String a Cliente")
    assert res["operation"] == "add_attribute"
    assert res["data"]["clase_nombre"] == "Cliente"
    assert res["data"]["nombre"] == "correo"
    assert res["data"]["tipo_dato"] == "String"


def test_parser_add_attribute_con_tipo_explicito():
    res = DeterministicVoiceParser.parse("Crea un atributo total Double a Factura")
    assert res["operation"] == "add_attribute"
    assert res["data"]["clase_nombre"] == "Factura"
    assert res["data"]["nombre"] == "total"
    assert res["data"]["tipo_dato"] == "Double"


def test_parser_remove_attribute_oficial_con_acento():
    res = DeterministicVoiceParser.parse("Elimina el atributo teléfono de Cliente")
    assert res["operation"] == "remove_attribute"
    assert res["data"]["clase_nombre"] == "Cliente"
    assert res["data"]["nombre"] == "teléfono"


def test_parser_remove_attribute_sin_acento():
    res = DeterministicVoiceParser.parse("Borra el atributo telefono de Cliente")
    assert res["operation"] == "remove_attribute"
    assert res["data"]["clase_nombre"] == "Cliente"
    assert res["data"]["nombre"] == "telefono"


def test_parser_create_relation_uno_a_muchos():
    res = DeterministicVoiceParser.parse("Relaciona Cliente con Venta uno a muchos")
    assert res["operation"] == "create_relation"
    assert res["data"]["origen"] == "Cliente"
    assert res["data"]["destino"] == "Venta"
    assert res["data"]["multiplicidad_origen"] == "1"
    assert res["data"]["multiplicidad_destino"] == "0..*"


def test_parser_create_relation_uno_a_uno():
    res = DeterministicVoiceParser.parse("Relaciona Cliente con Perfil uno a uno")
    assert res["operation"] == "create_relation"
    assert res["data"]["multiplicidad_origen"] == "1"
    assert res["data"]["multiplicidad_destino"] == "1"


def test_parser_create_relation_muchos_a_muchos():
    res = DeterministicVoiceParser.parse("Relaciona Estudiante con Curso muchos a muchos")
    assert res["operation"] == "create_relation"
    assert res["data"]["multiplicidad_origen"] == "0..*"
    assert res["data"]["multiplicidad_destino"] == "0..*"


def test_parser_create_relation_muchos_a_uno():
    res = DeterministicVoiceParser.parse("Relaciona Factura con Cliente muchos a uno")
    assert res["operation"] == "create_relation"
    assert res["data"]["multiplicidad_origen"] == "0..*"
    assert res["data"]["multiplicidad_destino"] == "1"


def test_parser_comando_desconocido_es_rechazado():
    with pytest.raises(HTTPException) as exc_info:
        DeterministicVoiceParser.parse("Quiero una hamburguesa con papas")
    assert exc_info.value.status_code == 400
    assert "no reconocido" in exc_info.value.detail.lower()


def test_parser_comando_vacio_es_rechazado():
    with pytest.raises(HTTPException) as exc_info:
        DeterministicVoiceParser.parse("   ...  ")
    assert exc_info.value.status_code == 400
    assert "vacía" in exc_info.value.detail.lower()


def test_parser_multiplicidad_invalida_es_rechazada():
    with pytest.raises(HTTPException) as exc_info:
        DeterministicVoiceParser.parse("Relaciona Cliente con Venta tres a diez")
    assert exc_info.value.status_code == 400
    assert "multiplicidad no reconocida" in exc_info.value.detail.lower()
