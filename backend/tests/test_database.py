import pytest
from sqlalchemy import text
from app.database.session import SessionLocal, engine
from app.models import (
    Usuario,
    Proyecto,
    ProyectoColaborador,
    Diagrama,
    ClaseUML,
    AtributoUML,
    MetodoUML,
    ParametroUML,
    RelacionUML,
    SesionColaborativa,
    SesionParticipante,
)


def test_postgresql_raw_connection():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1")).scalar()
        assert res == 1


def test_all_11_models_queriable():
    db = SessionLocal()
    try:
        # 1. usuario
        usuarios = db.query(Usuario).all()
        assert isinstance(usuarios, list)
        assert len(usuarios) > 0, "Debe existir al menos un usuario en la BD de prueba"

        # 2. proyecto
        proyectos = db.query(Proyecto).all()
        assert isinstance(proyectos, list)

        # 3. proyecto_colaborador
        colabs = db.query(ProyectoColaborador).all()
        assert isinstance(colabs, list)

        # 4. diagrama
        diagramas = db.query(Diagrama).all()
        assert isinstance(diagramas, list)

        # 5. clase_uml
        clases = db.query(ClaseUML).all()
        assert isinstance(clases, list)

        # 6. atributo_uml
        atributos = db.query(AtributoUML).all()
        assert isinstance(atributos, list)

        # 7. metodo_uml
        metodos = db.query(MetodoUML).all()
        assert isinstance(metodos, list)

        # 8. parametro_uml
        parametros = db.query(ParametroUML).all()
        assert isinstance(parametros, list)

        # 9. relacion_uml
        relaciones = db.query(RelacionUML).all()
        assert isinstance(relaciones, list)

        # 10. sesion_colaborativa
        sesiones = db.query(SesionColaborativa).all()
        assert isinstance(sesiones, list)

        # 11. sesion_participante
        participantes = db.query(SesionParticipante).all()
        assert isinstance(participantes, list)
    finally:
        db.close()


def test_model_relationships():
    db = SessionLocal()
    try:
        # Query first project and verify owner relationship
        proyecto = db.query(Proyecto).first()
        if proyecto:
            assert proyecto.propietario is not None
            assert proyecto.propietario.id_usuario == proyecto.id_propietario

        # Query first class and verify diagram relationship
        clase = db.query(ClaseUML).first()
        if clase:
            assert clase.diagrama is not None
            assert clase.diagrama.id_diagrama == clase.id_diagrama
    finally:
        db.close()
