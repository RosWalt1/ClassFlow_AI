import re
import unicodedata
from typing import Dict, Any, Optional
from fastapi import HTTPException, status

from app.schemas.voice import VoiceCommandOperation


def normalize_accents(text: str) -> str:
    """Elimina diacríticos/acentos y pasa a minúsculas para comparaciones semánticas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).strip().lower()


def to_pascal_case(text: str) -> str:
    """Convierte una cadena de una o varias palabras separadas por espacios a formato PascalCase para UML."""
    clean = re.sub(r'[^A-Za-z0-9_áéíóúÁÉÍÓÚñÑ\s]', '', text).strip()
    words = clean.split()
    if not words:
        return ""
    result_parts = []
    for w in words:
        if len(w) == 1:
            result_parts.append(w.upper())
        elif w.islower() or w.isupper():
            result_parts.append(w.capitalize())
        else:
            result_parts.append(w[0].upper() + w[1:])
    return "".join(result_parts)



class DeterministicVoiceParser:
    """
    Parser sintáctico determinista y estricto para comandos de voz en ClassFlow AI (CU06).
    Garantiza que una misma transcripción siempre produzca exactamente la misma operación UML
    y los mismos parámetros, eliminando por completo el no-determinismo de los LLMs.
    """

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Normaliza espacios y signos de puntuación periféricos."""
        if not text:
            return ""
        t = text.strip()
        # Eliminar comillas, puntos y signos de puntuación finales
        t = re.sub(r'^[¿"\'“«\s]+|[?."\'”»\s]+$', '', t)
        # Normalizar espacios intermedios múltiples a un solo espacio
        t = re.sub(r'\s+', ' ', t)
        return t.strip()

    @classmethod
    def parse(cls, transcripcion: str) -> Dict[str, Any]:
        """
        Analiza una frase en español y extrae la operación y sus datos.
        Lanza HTTPException(400) si el comando es ambiguo, incompleto o desconocido.
        """
        raw = cls.clean_text(transcripcion)
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La transcripción de voz está vacía.",
            )

        # 1. ADD_CLASS
        # Acepta nombres simples o compuestos (ej: "Factura", "factura voz", "detalle venta", "orden de compra")
        m1 = re.search(
            r"^(?:agrega|agregar|crea|crear)\s+(?:una\s+)?clase\s+([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ\s]+)$",
            raw,
            re.IGNORECASE,
        )
        if m1:
            raw_name = m1.group(1).strip()
            nombre_clase = to_pascal_case(raw_name)
            if not nombre_clase:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre de la clase a crear no puede estar vacío.",
                )
            return {
                "operation": VoiceCommandOperation.ADD_CLASS.value,
                "data": {
                    "nombre": nombre_clase,
                    "estereotipo": "«entity»",
                    "visibilidad": "public",
                },
            }

        # 2. ADD_ATTRIBUTE
        # Ejemplos: "Agrega un atributo correo String a Cliente", "Crea un atributo total Double a Factura"
        m2 = re.search(
            r"^(?:agrega|agregar|crea|crear)\s+(?:un\s+)?atributo\s+([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)(?:\s+(?:de\s+tipo\s+)?([A-Za-z0-9_<>]+))?\s+a\s+(?:la\s+clase\s+)?([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)$",
            raw,
            re.IGNORECASE,
        )
        if m2:
            attr_name = m2.group(1).strip()
            tipo_dato = (m2.group(2) or "String").strip()
            clase_name = m2.group(3).strip()
            return {
                "operation": VoiceCommandOperation.ADD_ATTRIBUTE.value,
                "data": {
                    "clase_nombre": clase_name,
                    "nombre": attr_name,
                    "tipo_dato": tipo_dato,
                    "visibilidad": "private",
                },
            }

        # 3. REMOVE_ATTRIBUTE
        # Ejemplos: "Elimina el atributo teléfono de Cliente", "Borra el atributo telefono de Cliente"
        m3 = re.search(
            r"^(?:elimina|eliminar|borra|borrar|quita|quitar)\s+(?:el\s+)?atributo\s+([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)\s+de\s+(?:la\s+clase\s+)?([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)$",
            raw,
            re.IGNORECASE,
        )
        if m3:
            attr_name = m3.group(1).strip()
            clase_name = m3.group(2).strip()
            return {
                "operation": VoiceCommandOperation.REMOVE_ATTRIBUTE.value,
                "data": {
                    "clase_nombre": clase_name,
                    "nombre": attr_name,
                },
            }

        # 4. CREATE_RELATION
        # Ejemplos: "Relaciona Cliente con Venta uno a muchos", "Conecta Cliente con Venta uno a uno"
        m4 = re.search(
            r"^(?:relaciona|relacionar|conecta|conectar)\s+([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)\s+con\s+([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)(?:\s+(.+))?$",
            raw,
            re.IGNORECASE,
        )
        if m4:
            origen = m4.group(1).strip()
            destino = m4.group(2).strip()
            mult_raw = (m4.group(3) or "").strip().lower()

            mult_orig, mult_dest = "1", "0..*"
            if mult_raw:
                if "uno a uno" in mult_raw or "1 a 1" in mult_raw:
                    mult_orig, mult_dest = "1", "1"
                elif "muchos a muchos" in mult_raw or "* a *" in mult_raw:
                    mult_orig, mult_dest = "0..*", "0..*"
                elif "muchos a uno" in mult_raw or "* a 1" in mult_raw:
                    mult_orig, mult_dest = "0..*", "1"
                elif "uno a muchos" in mult_raw or "1 a *" in mult_raw:
                    mult_orig, mult_dest = "1", "0..*"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Multiplicidad no reconocida: '{mult_raw}'. "
                            "Formatos válidos: 'uno a muchos', 'uno a uno', 'muchos a muchos', 'muchos a uno'."
                        ),
                    )

            return {
                "operation": VoiceCommandOperation.CREATE_RELATION.value,
                "data": {
                    "origen": origen,
                    "destino": destino,
                    "tipo": "asociacion",
                    "multiplicidad_origen": mult_orig,
                    "multiplicidad_destino": mult_dest,
                    "nombre": None,
                },
            }

        # Si no encaja con ninguna de las 4 operaciones oficiales
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Comando de voz no reconocido: '{raw}'. "
                "Las operaciones admitidas son exclusivamente: "
                "crear clase ('Agrega una clase Factura'), "
                "agregar atributo ('Agrega un atributo correo String a Cliente'), "
                "eliminar atributo ('Elimina el atributo teléfono de Cliente') y "
                "relacionar clases ('Relaciona Cliente con Venta uno a muchos')."
            ),
        )
