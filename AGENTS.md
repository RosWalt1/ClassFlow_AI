# CLASSFLOW AI - INSTRUCCIONES PARA AGENTES

Antes de realizar cualquier modificación en este repositorio debes leer:

1. Este archivo completo.
2. docs/DEVELOPMENT_PLAN.md
3. README.md cuando necesites información de ejecución o arquitectura.

## REGLA PRINCIPAL

El desarrollo de ClassFlow AI está dividido en fases.

NUNCA ejecutes más de una fase sin autorización explícita del usuario.

Cuando termines una fase:

- ejecuta las pruebas correspondientes;
- verifica build y errores;
- informa archivos modificados;
- informa endpoints creados;
- explica cómo probarlo;
- detente.

NO continúes automáticamente con la siguiente fase.

## PROYECTO

ClassFlow AI es una herramienta CASE colaborativa especializada
exclusivamente en diagramas de clases UML.

El diagrama de clases se utiliza posteriormente para generar
automáticamente un backend Java + Spring Boot.

## ACTORES OFICIALES

Existen exactamente:

1. Propietario del proyecto
2. Desarrollador invitado

No crear otros actores.

## CASOS DE USO OFICIALES

CU01 Iniciar sesión
CU02 Gestionar proyecto
CU03 Crear y editar diagrama de clases
CU04 Colaborar en tiempo real
CU05 Crear diagrama mediante IA
CU06 Gestionar diagrama mediante voz
CU07 Importar diagrama desde imagen
CU08 Importar diagrama UML
CU09 Exportar diagrama UML
CU10 Generar backend a partir del diagrama
CU11 Descargar backend generado

No cambiar nombres ni numeración.

## STACK

Frontend:
React + TypeScript + Vite + Tailwind CSS

Backend interno ClassFlow AI:
Python + FastAPI + SQLAlchemy + Pydantic + JWT + WebSocket

Base de datos:
PostgreSQL
Base: classflow_ai

Backend GENERADO:
Java + Spring Boot + Spring Data JPA + PostgreSQL

No confundir backend interno con backend generado.

## PROHIBICIONES

- No rehacer la interfaz existente.
- No crear otro frontend.
- No cambiar PostgreSQL.
- No crear actor Administrador.
- No convertir ClassFlow AI en editor UML genérico.
- No desarrollar módulos de ventas.
- Cliente/Venta/Producto son solamente ejemplos UML.
- No generar NestJS como backend oficial.
- No exponer API keys.
- No subir .env.
- No borrar la base de datos.
- No ejecutar DROP DATABASE.
- No avanzar automáticamente de fase.

## PLAN

El plan completo y requisitos de cada fase están en:

docs/DEVELOPMENT_PLAN.md

Antes de comenzar una fase debes leer su definición completa.
