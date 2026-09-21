-- ============================================================================
-- CLASSFLOW AI - INITIAL DATABASE SCHEMA & SEED DATA
-- Auto-executed on PostgreSQL container creation (/docker-entrypoint-initdb.d)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuario (
	id_usuario BIGSERIAL NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	apellido VARCHAR(100), 
	email VARCHAR(150) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	fecha_registro TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	ultimo_acceso TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id_usuario)
);

CREATE TABLE IF NOT EXISTS proyecto (
	id_proyecto BIGSERIAL NOT NULL, 
	id_propietario BIGINT NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	descripcion VARCHAR(500), 
	estado VARCHAR(20) NOT NULL, 
	fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_modificacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id_proyecto), 
	FOREIGN KEY(id_propietario) REFERENCES usuario (id_usuario)
);

CREATE TABLE IF NOT EXISTS diagrama (
	id_diagrama BIGSERIAL NOT NULL, 
	id_proyecto BIGINT NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	descripcion VARCHAR(500), 
	version INTEGER NOT NULL, 
	fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_modificacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id_diagrama), 
	FOREIGN KEY(id_proyecto) REFERENCES proyecto (id_proyecto)
);

CREATE TABLE IF NOT EXISTS proyecto_colaborador (
	id_colaborador BIGSERIAL NOT NULL, 
	id_proyecto BIGINT NOT NULL, 
	id_usuario BIGINT NOT NULL, 
	permiso_edicion BOOLEAN NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	fecha_invitacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_aceptacion TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id_colaborador), 
	FOREIGN KEY(id_proyecto) REFERENCES proyecto (id_proyecto), 
	FOREIGN KEY(id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE IF NOT EXISTS clase_uml (
	id_clase BIGSERIAL NOT NULL, 
	id_diagrama BIGINT NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	estereotipo VARCHAR(50), 
	visibilidad VARCHAR(20) NOT NULL, 
	es_abstracta BOOLEAN NOT NULL, 
	posicion_x NUMERIC(10, 2) NOT NULL, 
	posicion_y NUMERIC(10, 2) NOT NULL, 
	ancho NUMERIC(10, 2) NOT NULL, 
	alto NUMERIC(10, 2) NOT NULL, 
	fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_modificacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id_clase), 
	FOREIGN KEY(id_diagrama) REFERENCES diagrama (id_diagrama)
);

CREATE TABLE IF NOT EXISTS sesion_colaborativa (
	id_sesion BIGSERIAL NOT NULL, 
	id_proyecto BIGINT NOT NULL, 
	id_diagrama BIGINT NOT NULL, 
	id_anfitrion BIGINT NOT NULL, 
	codigo_sesion VARCHAR(50) NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	fecha_inicio TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_fin TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id_sesion), 
	FOREIGN KEY(id_proyecto) REFERENCES proyecto (id_proyecto), 
	FOREIGN KEY(id_diagrama) REFERENCES diagrama (id_diagrama), 
	FOREIGN KEY(id_anfitrion) REFERENCES usuario (id_usuario)
);

CREATE TABLE IF NOT EXISTS atributo_uml (
	id_atributo BIGSERIAL NOT NULL, 
	id_clase BIGINT NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	tipo_dato VARCHAR(100) NOT NULL, 
	visibilidad VARCHAR(20) NOT NULL, 
	valor_defecto VARCHAR(100), 
	es_estatico BOOLEAN NOT NULL, 
	es_final BOOLEAN NOT NULL, 
	es_nullable BOOLEAN NOT NULL, 
	orden INTEGER NOT NULL, 
	PRIMARY KEY (id_atributo), 
	FOREIGN KEY(id_clase) REFERENCES clase_uml (id_clase)
);

CREATE TABLE IF NOT EXISTS metodo_uml (
	id_metodo BIGSERIAL NOT NULL, 
	id_clase BIGINT NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	tipo_retorno VARCHAR(100) NOT NULL, 
	visibilidad VARCHAR(20) NOT NULL, 
	es_estatico BOOLEAN NOT NULL, 
	es_abstracto BOOLEAN NOT NULL, 
	orden INTEGER NOT NULL, 
	PRIMARY KEY (id_metodo), 
	FOREIGN KEY(id_clase) REFERENCES clase_uml (id_clase)
);

CREATE TABLE IF NOT EXISTS relacion_uml (
	id_relacion BIGSERIAL NOT NULL, 
	id_diagrama BIGINT NOT NULL, 
	id_clase_origen BIGINT NOT NULL, 
	id_clase_destino BIGINT NOT NULL, 
	tipo VARCHAR(50) NOT NULL, 
	nombre VARCHAR(100), 
	multiplicidad_origen VARCHAR(20), 
	multiplicidad_destino VARCHAR(20), 
	rol_origen VARCHAR(100), 
	rol_destino VARCHAR(100), 
	navegabilidad_origen BOOLEAN NOT NULL, 
	navegabilidad_destino BOOLEAN NOT NULL, 
	fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id_relacion), 
	FOREIGN KEY(id_diagrama) REFERENCES diagrama (id_diagrama), 
	FOREIGN KEY(id_clase_origen) REFERENCES clase_uml (id_clase), 
	FOREIGN KEY(id_clase_destino) REFERENCES clase_uml (id_clase)
);

CREATE TABLE IF NOT EXISTS sesion_participante (
	id_participante BIGSERIAL NOT NULL, 
	id_sesion BIGINT NOT NULL, 
	id_usuario BIGINT NOT NULL, 
	fecha_ingreso TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_salida TIMESTAMP WITHOUT TIME ZONE, 
	estado VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id_participante), 
	FOREIGN KEY(id_sesion) REFERENCES sesion_colaborativa (id_sesion), 
	FOREIGN KEY(id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE IF NOT EXISTS parametro_uml (
	id_parametro BIGSERIAL NOT NULL, 
	id_metodo BIGINT NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	tipo_dato VARCHAR(100) NOT NULL, 
	valor_defecto VARCHAR(100), 
	orden INTEGER NOT NULL, 
	PRIMARY KEY (id_parametro), 
	FOREIGN KEY(id_metodo) REFERENCES metodo_uml (id_metodo)
);


-- ============================================================================
-- SEED DATA: USUARIOS OFICIALES
-- Password hash corresponde a 'Carlos123!' (bcrypt)
-- ============================================================================
INSERT INTO usuario (id_usuario, nombre, apellido, email, password_hash, estado, fecha_registro)
VALUES 
    (1, 'Carlos', 'Mendoza', 'carlos@classflow.com', '$2b$12$VRQ49TyNX7/m.r0SK7irlu.GPeyagcCjMADITiYAgS/evdPIo36hy', 'activo', now()),
    (2, 'Ana', 'Lopez', 'ana@classflow.com', '$2b$12$VRQ49TyNX7/m.r0SK7irlu.GPeyagcCjMADITiYAgS/evdPIo36hy', 'activo', now()),
    (3, 'Luis', 'Rojas', 'luis@classflow.com', '$2b$12$VRQ49TyNX7/m.r0SK7irlu.GPeyagcCjMADITiYAgS/evdPIo36hy', 'activo', now()),
    (4, 'Usuario Inactivo', NULL, 'inactivo@classflow.com', '$2b$12$VRQ49TyNX7/m.r0SK7irlu.GPeyagcCjMADITiYAgS/evdPIo36hy', 'inactivo', now())
ON CONFLICT (id_usuario) DO NOTHING;

-- SEED DATA: PROYECTO INICIAL
INSERT INTO proyecto (id_proyecto, id_propietario, nombre, descripcion, estado, fecha_creacion, fecha_modificacion)
VALUES 
    (1, 1, 'Sistema de Ventas', 'Proyecto inicial de demostración UML', 'activo', now(), now())
ON CONFLICT (id_proyecto) DO NOTHING;

-- SEED DATA: DIAGRAMA INICIAL
INSERT INTO diagrama (id_diagrama, id_proyecto, nombre, descripcion, version, fecha_creacion, fecha_modificacion)
VALUES 
    (1, 1, 'Diagrama de clases principal', 'Diagrama inicial para modelado de clases UML', 1, now(), now())
ON CONFLICT (id_diagrama) DO NOTHING;

-- ACTUALIZAR SECUENCIAS
SELECT setval('usuario_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuario), 1));
SELECT setval('proyecto_id_proyecto_seq', COALESCE((SELECT MAX(id_proyecto) FROM proyecto), 1));
SELECT setval('diagrama_id_diagrama_seq', COALESCE((SELECT MAX(id_diagrama) FROM diagrama), 1));
