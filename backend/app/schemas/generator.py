from typing import List, Literal
from pydantic import BaseModel, Field


class GeneratedFileItem(BaseModel):
    path: str = Field(..., description="Ruta relativa del archivo dentro del proyecto generado")
    name: str = Field(..., description="Nombre del archivo (ej. Cliente.java, pom.xml)")
    category: Literal["model", "repository", "service", "controller", "config", "root"] = Field(
        ..., description="Categoría lógica del archivo"
    )
    content: str = Field(..., description="Contenido completo del código fuente generado")


class GenerationMetrics(BaseModel):
    total_classes: int = Field(..., description="Cantidad de clases/entidades UML procesadas")
    total_attributes: int = Field(..., description="Cantidad total de atributos UML procesados")
    total_methods: int = Field(..., description="Cantidad total de métodos UML procesados")
    total_relations: int = Field(..., description="Cantidad total de relaciones UML procesadas")
    total_files: int = Field(..., description="Cantidad de archivos Java y configuración generados")


class BackendGenerateResponse(BaseModel):
    success: bool = Field(True, description="Indica si la generación fue exitosa")
    framework: str = Field(
        "Java 17 + Spring Boot 3.2 + Spring Data JPA + PostgreSQL",
        description="Stack tecnológico generado",
    )
    project_name: str = Field(..., description="Nombre del proyecto ClassFlow")
    diagram_name: str = Field(..., description="Nombre del diagrama de clases UML")
    package_name: str = Field(..., description="Paquete base Java utilizado")
    metrics: GenerationMetrics = Field(..., description="Métricas reales del modelo UML")
    files: List[GeneratedFileItem] = Field(..., description="Colección de archivos generados")
    summary: str = Field(..., description="Resumen descriptivo de la generación")
