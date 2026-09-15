# PROYECTO: CLASSFLOW AI

Quiero que actúes como desarrollador senior full-stack y arquitecto de software para continuar el desarrollo de mi proyecto universitario llamado:

CLASSFLOW AI

IMPORTANTE:
NO debes desarrollar todo el sistema de una sola vez.

El desarrollo debe realizarse ESTRICTAMENTE POR FASES.

Debes completar UNA SOLA FASE, comprobar que funciona, informarme exactamente qué realizaste y DETENERTE.

NO continúes con la siguiente fase hasta que yo te escriba explícitamente algo como:

"CONTINUAR CON LA SIGUIENTE FASE"

Si encuentras un error de una fase anterior, corrígelo antes de avanzar.

============================================================
1. REPOSITORIO EXISTENTE
============================================================

Ya existe un proyecto frontend y debes TRABAJAR SOBRE ÉL.

NO crear otro proyecto desde cero.

NO reemplazar innecesariamente la interfaz existente.

NO eliminar componentes funcionales solamente para reconstruirlos de otra manera.

Primero analiza completamente el repositorio existente.

El proyecto actualmente contiene aproximadamente:

src/
├── components/
│   ├── BackendGeneratorScreen.tsx
│   ├── EditorScreen.tsx
│   ├── Header.tsx
│   ├── LoginScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── ProjectsScreen.tsx
│   ├── RegisterScreen.tsx
│   └── Sidebar.tsx
├── data/
│   └── mockData.ts
├── App.tsx
├── index.css
├── main.tsx
└── types.ts

La interfaz actual fue diseñada previamente y visualmente ya está aceptada.

CONSERVAR EL DISEÑO ACTUAL.

Puedes modificar código interno, arquitectura, servicios, navegación y lógica cuando sea necesario, pero intenta mantener la apariencia visual existente.

============================================================
2. OBJETIVO DEL SOFTWARE
============================================================

ClassFlow AI es una herramienta CASE colaborativa especializada en la creación y edición de:

DIAGRAMAS DE CLASES UML.

NO es un editor UML genérico.

El diagrama de clases constituye el modelo principal del sistema porque posteriormente ClassFlow AI debe generar automáticamente un backend Java + Spring Boot a partir de dicho modelo.

Flujo principal:

Usuario
→ inicia sesión
→ crea o abre un proyecto
→ crea/edita un diagrama de clases UML
→ define clases
→ atributos
→ métodos
→ parámetros
→ relaciones
→ multiplicidades
→ puede colaborar con otros usuarios
→ puede utilizar IA
→ puede utilizar voz
→ puede importar una imagen
→ puede importar/exportar UML
→ valida el modelo
→ genera backend Java + Spring Boot
→ descarga el backend generado.

============================================================
3. ACTORES OFICIALES
============================================================

Existen EXACTAMENTE DOS actores:

1. Propietario del proyecto
2. Desarrollador invitado

NO crear actor Administrador.

NO crear actor Anfitrión separado.

NO crear actor Colaborador separado.

NO crear otros roles.

El propietario posee permisos superiores dentro de SUS proyectos.

El desarrollador invitado participa solamente en proyectos donde haya sido invitado.

============================================================
4. CASOS DE USO OFICIALES
============================================================

Existen EXACTAMENTE estos 11 casos de uso:

CU01 - Iniciar sesión
CU02 - Gestionar proyecto
CU03 - Crear y editar diagrama de clases
CU04 - Colaborar en tiempo real
CU05 - Crear diagrama mediante IA
CU06 - Gestionar diagrama mediante voz
CU07 - Importar diagrama desde imagen
CU08 - Importar diagrama UML
CU09 - Exportar diagrama UML
CU10 - Generar backend a partir del diagrama
CU11 - Descargar backend generado

NO cambiar estos nombres.

NO renumerarlos.

NO crear nuevos casos de uso principales sin autorización.

============================================================
5. PERMISOS DE LOS CASOS DE USO
============================================================

CU01:
Propietario + Desarrollador invitado

CU02:
Solo Propietario

CU03:
Propietario + Desarrollador invitado

CU04:
Propietario + Desarrollador invitado

CU05:
Propietario + Desarrollador invitado

CU06:
Propietario + Desarrollador invitado

CU07:
Solo Propietario

CU08:
Solo Propietario

CU09:
Solo Propietario

CU10:
Solo Propietario

CU11:
Solo Propietario

Implementar autorización real.

No basta con ocultar botones en frontend.

Las operaciones restringidas deben validarse también desde backend.

============================================================
6. TECNOLOGÍAS
============================================================

FRONTEND EXISTENTE:

- React
- TypeScript
- Vite
- Tailwind CSS

Para el editor visual se puede incorporar:

- React Flow / @xyflow/react

siempre que sea necesario y no destruya el diseño existente.

BACKEND INTERNO DE CLASSFLOW AI:

Utilizar:

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT
- WebSocket

BASE DE DATOS PRINCIPAL:

- PostgreSQL

Base:

classflow_ai

IMPORTANTE:

El backend INTERNO de ClassFlow AI será FastAPI.

El backend que ClassFlow AI GENERA a partir del diagrama será:

- Java
- Spring Boot
- Spring Data JPA
- PostgreSQL
- REST API

No confundir ambos backends.

============================================================
7. BASE DE DATOS EXISTENTE
============================================================

La base PostgreSQL ya fue creada.

Nombre:

classflow_ai

Actualmente posee 11 tablas:

1. usuario
2. proyecto
3. proyecto_colaborador
4. diagrama
5. clase_uml
6. atributo_uml
7. metodo_uml
8. parametro_uml
9. relacion_uml
10. sesion_colaborativa
11. sesion_participante

NO recrear arbitrariamente una base diferente.

NO cambiar nombres de tablas sin una razón técnica importante y sin informarme primero.

Trabajar inicialmente sobre este modelo.

============================================================
8. MODELO CONCEPTUAL DE DATOS
============================================================

usuario:
- id_usuario
- nombre
- apellido
- email
- password_hash
- estado
- fecha_registro
- ultimo_acceso

proyecto:
- id_proyecto
- id_propietario
- nombre
- descripcion
- estado
- fecha_creacion
- fecha_modificacion

proyecto_colaborador:
- id_colaborador
- id_proyecto
- id_usuario
- permiso_edicion
- estado
- fecha_invitacion
- fecha_aceptacion

diagrama:
- id_diagrama
- id_proyecto
- nombre
- descripcion
- version
- fecha_creacion
- fecha_modificacion

clase_uml:
- id_clase
- id_diagrama
- nombre
- estereotipo
- visibilidad
- es_abstracta
- posicion_x
- posicion_y
- ancho
- alto
- fecha_creacion
- fecha_modificacion

atributo_uml:
- id_atributo
- id_clase
- nombre
- tipo_dato
- visibilidad
- valor_defecto
- es_estatico
- es_final
- es_nullable
- orden

metodo_uml:
- id_metodo
- id_clase
- nombre
- tipo_retorno
- visibilidad
- es_estatico
- es_abstracto
- orden

parametro_uml:
- id_parametro
- id_metodo
- nombre
- tipo_dato
- valor_defecto
- orden

relacion_uml:
- id_relacion
- id_diagrama
- id_clase_origen
- id_clase_destino
- tipo
- nombre
- multiplicidad_origen
- multiplicidad_destino
- rol_origen
- rol_destino
- navegabilidad_origen
- navegabilidad_destino
- fecha_creacion

Tipos permitidos inicialmente:

asociacion
agregacion
composicion
herencia
dependencia
realizacion

sesion_colaborativa:
- id_sesion
- id_proyecto
- id_diagrama
- id_anfitrion
- codigo_sesion
- estado
- fecha_inicio
- fecha_fin

sesion_participante:
- id_participante
- id_sesion
- id_usuario
- fecha_ingreso
- fecha_salida
- estado

============================================================
9. ESTADO ACTUAL DEL FRONTEND
============================================================

IMPORTANTE:

El frontend existente NO debe asumirse como funcional solamente porque visualmente parece completo.

Actualmente existen datos MOCK.

Existe un archivo similar a:

src/data/mockData.ts

que contiene usuarios, proyectos, clases, relaciones y código generado simulado.

Actualmente existen usuarios ficticios como:

Carlos Mendoza
Ana López

y ejemplos:

Cliente
Venta
Producto

Esos datos pueden mantenerse temporalmente mientras se implementa cada fase, pero progresivamente deben ser reemplazados por datos reales provenientes de la API.

NO eliminar todos los mocks al principio.

Eliminar/reemplazar mocks solamente cuando la funcionalidad correspondiente ya esté conectada y comprobada.

============================================================
10. REGLA DE DESARROLLO
============================================================

ANTES DE MODIFICAR:

1. Analiza el código existente.
2. Identifica dependencias.
3. Identifica componentes.
4. Identifica estados.
5. Identifica datos mock.
6. Identifica qué funcionalidad ya existe.
7. Ejecuta el proyecto.
8. Comprueba que compile.

Después realiza solamente la fase solicitada.

AL FINAL DE CADA FASE:

1. Ejecuta frontend.
2. Ejecuta backend si corresponde.
3. Comprueba errores de TypeScript.
4. Comprueba errores de Python.
5. Comprueba conexión con PostgreSQL.
6. Realiza pruebas de la funcionalidad implementada.
7. Corrige errores encontrados.
8. No avances si existen errores importantes.

============================================================
11. PROHIBICIONES GENERALES
============================================================

NO desarrollar todo de una sola vez.

NO cambiar el diseño visual completo.

NO crear otro frontend.

NO sustituir React.

NO convertir el proyecto en Next.js.

NO cambiar PostgreSQL por MongoDB.

NO utilizar Firebase como base principal.

NO utilizar Supabase como sustitución de PostgreSQL.

NO crear un sistema de ventas.

Cliente, Venta y Producto son ejemplos UML, NO módulos de negocio de ClassFlow AI.

NO crear CRUD de Cliente/Venta/Producto dentro de ClassFlow AI.

NO agregar diagramas UML diferentes al diagrama de clases.

NO crear panel administrativo.

NO crear actor Administrador.

NO implementar NestJS como backend generado.

NO dejar funcionalidades críticas solamente simuladas cuando su fase ya haya sido implementada.

NO exponer claves API en frontend.

NO guardar contraseñas en texto plano.

NO realizar commits gigantes que mezclen varias fases.

============================================================
12. FASE 0 - AUDITORÍA Y PREPARACIÓN
============================================================

ESTA ES LA PRIMERA FASE QUE DEBES REALIZAR.

NO implementar todavía funcionalidades nuevas.

Objetivo:

Comprender completamente el proyecto existente y dejarlo preparado para desarrollo.

Realizar:

- Revisar estructura completa.
- Revisar package.json.
- Revisar App.tsx.
- Revisar types.ts.
- Revisar mockData.ts.
- Revisar EditorScreen.
- Revisar ProjectsScreen.
- Revisar LoginScreen.
- Revisar BackendGeneratorScreen.
- Revisar Header.
- Revisar Sidebar.
- Revisar ProfileScreen.
- Revisar RegisterScreen.
- Ejecutar npm/bun install según corresponda.
- Ejecutar frontend.
- Ejecutar TypeScript check.
- Ejecutar build.
- Identificar código mock.
- Identificar botones sin funcionalidad.
- Identificar lógica simulada.
- Identificar posibles errores.
- Identificar componentes demasiado grandes que posteriormente convenga dividir.

NO hacer refactor masivo todavía.

ENTREGABLE DE FASE 0:

Informarme:

- estructura encontrada;
- tecnologías encontradas;
- qué funciona realmente;
- qué está simulado;
- errores encontrados;
- riesgos técnicos;
- archivos que será necesario modificar posteriormente.

DETENERTE.

ESPERAR MI APROBACIÓN.

============================================================
13. FASE 1 - BACKEND BASE + POSTGRESQL
============================================================

SOLO ejecutar cuando yo apruebe FASE 0.

Crear backend interno de ClassFlow AI.

Crear estructura separada, por ejemplo:

backend/
├── app/
│   ├── main.py
│   ├── core/
│   ├── database/
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   └── dependencies/
├── requirements.txt
└── .env.example

Utilizar FastAPI.

Configurar:

- SQLAlchemy.
- PostgreSQL.
- Variables de entorno.
- CORS.
- Endpoint health.

Ejemplo:

GET /api/health

Debe responder correctamente.

Conectar a:

classflow_ai

Mapear inicialmente las tablas existentes.

NO borrar datos existentes.

NO ejecutar DROP DATABASE.

NO ejecutar DROP TABLE.

NO modificar destructivamente la BD.

Comprobar conexión real.

ENTREGABLE:

- backend ejecutándose;
- FastAPI funcionando;
- PostgreSQL conectado;
- health endpoint funcionando;
- modelos base creados;
- instrucciones de ejecución.

DETENERTE.

============================================================
14. FASE 2 - CU01 INICIAR SESIÓN
============================================================

Implementar autenticación REAL.

Backend:

- búsqueda de usuario por email;
- validación de contraseña;
- password hashing seguro;
- JWT;
- endpoint login;
- endpoint usuario actual;
- control de usuario activo;
- actualización último acceso.

Ejemplo conceptual:

POST /api/auth/login
GET /api/auth/me

Frontend:

Conectar LoginScreen existente.

Eliminar la selección artificial Carlos/Ana para autenticación normal.

Mantener temporalmente los mocks de otras funcionalidades.

Al iniciar sesión:

Login
→ API
→ PostgreSQL
→ JWT
→ sesión frontend
→ pantalla de proyectos.

Implementar logout.

Proteger pantallas privadas.

IMPORTANTE:

No utilizar localStorage de manera insegura si puede evitarse.
Adoptar una estrategia razonable para el contexto académico y documentarla.

PRUEBAS:

- credenciales válidas;
- contraseña incorrecta;
- usuario inexistente;
- usuario inactivo;
- acceso sin autenticación;
- token válido.

ENTREGABLE:

CU01 funcional de extremo a extremo.

DETENERTE.

============================================================
15. FASE 3 - CU02 GESTIONAR PROYECTO
============================================================

Implementar proyectos reales.

SOLO Propietario.

Backend:

- crear proyecto;
- consultar proyectos propios;
- consultar proyecto;
- modificar proyecto;
- archivar proyecto;
- consultar colaboradores;
- invitar colaborador;
- cambiar permiso de edición;
- retirar/revocar colaborador.

NO eliminar necesariamente físicamente proyectos.
Utilizar estado archivado cuando corresponda.

Frontend:

Conectar ProjectsScreen existente con API.

Nuevo proyecto debe persistir en PostgreSQL.

Al refrescar navegador, proyecto debe continuar existiendo.

Separar:

Mis proyectos
Proyectos compartidos

Los proyectos compartidos deben obtenerse desde proyecto_colaborador.

Eliminar mocks de proyectos cuando esta fase funcione.

PRUEBAS:

- crear;
- listar;
- editar;
- archivar;
- invitar;
- permisos;
- usuario no autorizado.

ENTREGABLE:

CU02 funcional.

DETENERTE.

============================================================
16. FASE 4 - CU03 CREAR Y EDITAR DIAGRAMA DE CLASES
============================================================

Esta es una de las fases más importantes.

Implementar persistencia REAL del editor UML.

El editor es exclusivamente de DIAGRAMAS DE CLASES.

Utilizar:

diagrama
clase_uml
atributo_uml
metodo_uml
parametro_uml
relacion_uml

Frontend:

Conservar el diseño existente del EditorScreen.

Evaluar incorporar @xyflow/react / React Flow para tener:

- nodos;
- edges;
- drag;
- zoom;
- pan;
- conexiones;
- selección.

Si la migración a React Flow destruye visualmente el diseño actual, conservar la apariencia mediante nodos personalizados.

Funcionalidades:

- crear clase;
- editar clase;
- eliminar clase;
- mover clase;
- agregar atributo;
- editar atributo;
- eliminar atributo;
- agregar método;
- editar método;
- eliminar método;
- agregar parámetros;
- editar parámetros;
- eliminar parámetros;
- crear relaciones;
- editar relaciones;
- eliminar relaciones;
- multiplicidades;
- navegabilidad;
- estereotipo;
- visibilidad;
- clase abstracta.

Relaciones:

- asociación;
- agregación;
- composición;
- herencia;
- dependencia;
- realización.

Persistir posiciones X/Y.

Persistir cambios.

Al cerrar y volver a abrir el proyecto, el diagrama debe reconstruirse correctamente.

NO depender de INITIAL_CLASSES después de completar esta fase.

Implementar validaciones básicas:

- nombre de clase obligatorio;
- evitar clases duplicadas dentro del mismo diagrama;
- origen/destino válidos;
- evitar relaciones corruptas;
- tipos de relación válidos.

PRUEBAS:

Crear:

Cliente
Venta
Producto

Agregar atributos y métodos.

Crear relaciones.

Guardar.

Recargar.

Comprobar que permanece exactamente igual.

ENTREGABLE:

CU03 funcional y persistente.

DETENERTE.

============================================================
17. FASE 5 - CU04 COLABORAR EN TIEMPO REAL
============================================================

Implementar colaboración REAL mediante WebSocket.

NO simular con setTimeout.

Utilizar:

sesion_colaborativa
sesion_participante

Requisitos:

- propietario abre proyecto;
- invitado autorizado puede entrar;
- ambos visualizan mismo diagrama;
- cambios se propagan;
- mostrar conectados;
- registrar ingreso;
- registrar salida;
- sincronizar creación;
- sincronizar edición;
- sincronizar movimiento;
- sincronizar eliminación;
- sincronizar relaciones.

Diseñar manejo razonable de concurrencia.

No es necesario implementar un CRDT extremadamente complejo para el parcial, pero evitar sobrescrituras absurdas.

Implementar control básico de versión/eventos.

Probar con DOS navegadores/sesiones.

Propietario modifica una clase.

Invitado debe visualizar el cambio sin recargar.

Invitado mueve clase.

Propietario debe visualizarlo.

ENTREGABLE:

CU04 funcional.

DETENERTE.

============================================================
18. FASE 6 - CU05 CREAR DIAGRAMA MEDIANTE IA
============================================================

Implementar IA REAL.

NO exponer API KEY en React.

La llamada a IA debe hacerse desde backend.

Crear servicio aislado.

El usuario puede escribir instrucciones como:

"Crea una clase Cliente con id Long, nombre String y correo String."

"Crea las clases Cliente, Pedido y Producto y sus relaciones."

La IA NO debe modificar directamente la base de datos mediante texto arbitrario.

Solicitar respuesta estructurada JSON.

Crear esquema validado mediante Pydantic.

Ejemplo conceptual:

{
  "classes": [...],
  "relations": [...]
}

Validar respuesta.

Transformar respuesta a entidades UML.

Persistir.

Actualizar canvas.

Implementar manejo de errores.

NO inventar clases si la IA devuelve respuesta inválida.

Registrar claramente qué cambios se aplicarán.

ENTREGABLE:

CU05 funcional con IA real.

DETENERTE.

============================================================
19. FASE 7 - CU06 GESTIONAR DIAGRAMA MEDIANTE VOZ
============================================================

Implementar voz sobre el mismo sistema de comandos.

Flujo:

Micrófono
→ reconocimiento
→ texto
→ interpretación
→ comando UML
→ validación
→ modificación
→ persistencia
→ canvas.

Ejemplos:

"Agrega una clase Factura."

"Agrega un atributo correo String a Cliente."

"Relaciona Cliente con Venta uno a muchos."

"Elimina el atributo teléfono de Cliente."

Conservar el modal/interfaz visual existente si ya existe.

Mostrar:

- escuchando;
- texto reconocido;
- confirmación;
- error.

ENTREGABLE:

CU06 funcional.

DETENERTE.

============================================================
20. FASE 8 - CU07 IMPORTAR DIAGRAMA DESDE IMAGEN
============================================================

SOLO PROPIETARIO.

Implementar carga real de imagen.

Aceptar formatos razonables:

PNG
JPG
JPEG

Backend:

- recibir imagen;
- validar;
- procesar;
- utilizar visión/OCR/IA multimodal según la solución elegida;
- identificar clases;
- atributos;
- métodos;
- relaciones;
- multiplicidades cuando sean reconocibles.

La respuesta debe transformarse a modelo UML estructurado.

ANTES de guardar:

mostrar vista previa.

Usuario debe poder:

Aplicar
Cancelar

Si aplica:

persistir en PostgreSQL y actualizar editor.

ENTREGABLE:

CU07 funcional.

DETENERTE.

============================================================
21. FASE 9 - CU08 Y CU09 INTEROPERABILIDAD UML
============================================================

Implementar:

CU08 Importar diagrama UML
CU09 Exportar diagrama UML

SOLO PROPIETARIO.

Objetivo:

Interoperabilidad con herramientas CASE como Enterprise Architect mediante un formato UML de intercambio, preferentemente XMI/XML compatible con el alcance definido.

IMPORTANTE:

No afirmar compatibilidad total con todas las versiones de Enterprise Architect si no está comprobada.

IMPORTACIÓN:

archivo
→ parser
→ validación
→ clases
→ atributos
→ métodos
→ relaciones
→ canvas
→ PostgreSQL.

EXPORTACIÓN:

modelo PostgreSQL
→ estructura UML/XMI
→ archivo
→ descarga.

Probar ciclo:

ClassFlow
→ exportar
→ importar nuevamente
→ comparar modelo.

ENTREGABLE:

CU08 y CU09 funcionales.

DETENERTE.

============================================================
22. FASE 10 - CU10 GENERAR BACKEND
============================================================

SOLO PROPIETARIO.

ESTA FASE ES CRÍTICA.

Eliminar la generación ficticia basada exclusivamente en:

SPRING_BOOT_FILES

El backend debe generarse REALMENTE a partir del diagrama actual.

ÚNICO STACK GENERADO OFICIAL:

JAVA + SPRING BOOT.

Eliminar opción NestJS del flujo oficial.

A partir de:

clase_uml
atributo_uml
metodo_uml
parametro_uml
relacion_uml

generar proyecto Spring Boot.

Debe generar, según corresponda:

Entity
Repository
Service
Controller

Configuración:

Spring Boot
Spring Web
Spring Data JPA
PostgreSQL

Transformar tipos UML razonablemente:

String → String
Long → Long
Integer → Integer
Boolean → Boolean
BigDecimal → BigDecimal
LocalDate → LocalDate
LocalDateTime → LocalDateTime

Relaciones UML deben traducirse razonablemente a JPA:

@OneToOne
@OneToMany
@ManyToOne
@ManyToMany

según multiplicidades y semántica.

Herencia debe manejarse de manera coherente o, si queda fuera del alcance inicial, reportar claramente la limitación.

ANTES de generar:

VALIDAR MODELO.

Ejemplos:

- nombres válidos;
- clases duplicadas;
- relaciones inválidas;
- tipos no soportados;
- modelo vacío.

Generar estructura compilable.

NO poner textos falsos como:

"AST Engine v2.4"

si no existe realmente ese motor.

ENTREGABLE:

CU10 funcional.

DETENERTE.

============================================================
23. FASE 11 - CU11 DESCARGAR BACKEND
============================================================

SOLO PROPIETARIO.

Empaquetar proyecto generado en ZIP.

El ZIP debe contener una estructura real.

Ejemplo:

proyecto-generado/
├── pom.xml
├── src/
│   └── main/
│       ├── java/
│       │   └── ...
│       │       ├── entity/
│       │       ├── repository/
│       │       ├── service/
│       │       └── controller/
│       └── resources/
│           └── application.properties
└── README.md

El proyecto descargado debe poder:

- abrirse;
- instalar dependencias Maven;
- compilar;
- arrancar;
- conectarse a PostgreSQL;
- exponer endpoints REST.

Realizar prueba real de compilación si Maven/Java están disponibles.

Idealmente ejecutar:

mvn clean test

o:

mvn clean package

No afirmar que compila si no fue comprobado.

ENTREGABLE:

CU11 funcional.

DETENERTE.

============================================================
24. FASE 12 - INTEGRACIÓN Y LIMPIEZA
============================================================

Solo cuando CU01-CU11 funcionen.

Eliminar:

- mocks que ya no sean necesarios;
- QuickScreenSwitcher de prototipo;
- botones ficticios;
- estados falsos;
- textos técnicos inventados;
- opciones NestJS;
- código muerto.

NO eliminar mocks que se utilicen legítimamente para pruebas si están claramente separados.

Incorporar routing real si todavía no existe.

Organizar frontend:

pages/
components/
services/
hooks/
types/
utils/

SIN realizar un refactor destructivo.

Centralizar API.

Manejo consistente de:

- loading;
- error;
- success;
- unauthorized;
- forbidden.

Verificar permisos propietario/invitado.

ENTREGABLE:

Sistema integrado.

DETENERTE.

============================================================
25. FASE 13 - PRUEBAS FINALES
============================================================

Ejecutar pruebas funcionales correspondientes a:

PR01 - Iniciar sesión
PR02 - Crear y editar diagrama
PR03 - Colaboración en tiempo real
PR04 - Creación mediante IA
PR05 - Voz
PR06 - Imagen
PR07 - Importación/exportación UML
PR08 - Generación backend
PR09 - Descarga y compilación

Verificar también:

- autorización;
- persistencia;
- validaciones;
- errores;
- seguridad básica;
- CORS;
- JWT;
- WebSocket;
- PostgreSQL.

Generar reporte:

PRUEBA
ENTRADA
RESULTADO ESPERADO
RESULTADO OBTENIDO
ESTADO

Solo marcar:

APROBADO

si realmente fue ejecutada satisfactoriamente.

Si no se ejecutó:

PENDIENTE

Si falló:

FALLIDO

No falsificar resultados.

============================================================
26. FORMATO OBLIGATORIO AL TERMINAR CADA FASE
============================================================

Al terminar CADA fase debes responderme exactamente con una estructura similar a:

FASE X COMPLETADA

1. QUÉ SE IMPLEMENTÓ
- ...
- ...

2. ARCHIVOS CREADOS
- ...

3. ARCHIVOS MODIFICADOS
- ...

4. BASE DE DATOS
- cambios realizados o "sin cambios"

5. ENDPOINTS IMPLEMENTADOS
- método + ruta + función

6. PRUEBAS REALIZADAS
- prueba
- resultado

7. CÓMO PUEDO PROBARLO YO
Dar instrucciones paso a paso.

8. PROBLEMAS O LIMITACIONES
- ...

9. ESTADO
APROBABLE / REQUIERE CORRECCIÓN

Después escribir:

"FASE X FINALIZADA. ESPERANDO TU APROBACIÓN PARA CONTINUAR."

Y DETENERTE.

NO iniciar automáticamente la siguiente fase.

============================================================
27. CONTROL DE GIT
============================================================

Trabajar de manera ordenada.

Antes de cambios importantes comprobar:

git status

No sobrescribir trabajo existente innecesariamente.

No borrar archivos sin verificar su función.

Cada fase debe quedar conceptualmente separada.

Utilizar mensajes de commit claros si se realizan commits.

Ejemplos:

feat: implement ClassFlow backend foundation
feat: implement JWT authentication
feat: connect project management to API
feat: persist UML class diagrams
feat: add realtime collaboration
feat: integrate AI diagram generation
feat: generate Spring Boot backend from UML

NO realizar force push.

NO reescribir historial innecesariamente.

NO subir:

.env
contraseñas
API keys
credenciales PostgreSQL
secretos JWT

Mantener:

.env.example

sin secretos reales.

============================================================
28. CRITERIO FINAL DEL PROYECTO
============================================================

ClassFlow AI solamente puede considerarse terminado cuando pueda demostrarse este flujo real:

Usuario inicia sesión
        ↓
PostgreSQL autentica
        ↓
Usuario crea proyecto
        ↓
Crea diagrama de clases
        ↓
Agrega clases
        ↓
Agrega atributos
        ↓
Agrega métodos
        ↓
Crea relaciones
        ↓
Los datos se guardan en PostgreSQL
        ↓
Otro usuario invitado entra
        ↓
Ambos colaboran en tiempo real
        ↓
IA puede crear/modificar el diagrama
        ↓
Voz puede ejecutar operaciones UML
        ↓
Imagen puede convertirse a modelo UML
        ↓
Puede importar/exportar UML
        ↓
Propietario genera backend
        ↓
ClassFlow transforma el modelo UML
        ↓
Genera Java + Spring Boot + JPA
        ↓
Descarga ZIP
        ↓
Proyecto generado compila y funciona.

============================================================
29. INSTRUCCIÓN ACTUAL
============================================================

AHORA MISMO:

REALIZA ÚNICAMENTE:

FASE 0 - AUDITORÍA Y PREPARACIÓN.

NO implementes FASE 1.

NO crees todavía el backend.

NO cambies la base de datos.

NO implementes IA.

NO implementes WebSocket.

NO implementes generación nueva.

Analiza el repositorio existente, ejecútalo, verifica build/lint y dame el informe solicitado.

Cuando termines:

DETENTE Y ESPERA MI APROBACIÓN.
