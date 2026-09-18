import json
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status, HTTPException
from sqlalchemy.orm import Session

from app.database.session import SessionLocal, get_db
from app.core.security import decode_access_token
from app.core.ws_manager import ws_manager
from app.models.usuario import Usuario
from app.services.diagrama_service import DiagramaService
from app.services.colaboracion_service import ColaboracionService
from app.dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Colaboración en Tiempo Real (CU04)"])


@router.get(
    "/diagramas/{diagrama_id}/sesion",
    summary="Consultar sesión colaborativa activa",
    description="Retorna información de la sesión colaborativa activa y participantes conectados en el diagrama.",
)
def get_sesion_info(
    diagrama_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return ColaboracionService.get_active_session_info(
        db=db, diagrama_id=diagrama_id, user_id=current_user.id_usuario
    )


@router.websocket("/ws/diagramas/{diagrama_id}")
async def websocket_diagrama_endpoint(
    websocket: WebSocket,
    diagrama_id: int,
    token: Optional[str] = Query(None),
):
    """
    Endpoint WebSocket para colaboración en tiempo real en diagramas UML.
    Ruta: WS /api/ws/diagramas/{diagrama_id}?token=<jwt>
    Autenticación: Token JWT en query param.
    Autorización: Valida pertenencia al proyecto (propietario, editor o lector).
    Rechaza usuarios no autenticados, ajenos, pendientes o revocados con código 1008.
    """
    db: Session = SessionLocal()
    user_id: Optional[int] = None
    conn_id: Optional[str] = None
    sesion_id: Optional[int] = None

    try:
        # 1. Validar presencia del token JWT
        if not token or not token.strip():
            logger.warning(f"[WS] Intento de conexión sin token al diagrama {diagrama_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token JWT requerido")
            return

        # 2. Decodificar y verificar JWT real
        try:
            token_data = decode_access_token(token.strip())
        except Exception:
            token_data = None

        if not token_data:
            logger.warning(f"[WS] Token JWT inválido o expirado en diagrama {diagrama_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token JWT inválido o expirado")
            return

        email = token_data.get("email")
        sub = token_data.get("sub")

        # 3. Validar existencia y estado del usuario en PostgreSQL
        query = db.query(Usuario).filter(Usuario.estado == "activo")
        if email:
            user = query.filter(Usuario.email == email).first()
        elif sub:
            try:
                user = query.filter(Usuario.id_usuario == int(sub)).first()
            except (ValueError, TypeError):
                user = None
        else:
            user = None

        if not user:
            logger.warning(f"[WS] Usuario inactivo o inexistente ({email or sub}) en diagrama {diagrama_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Usuario inactivo o inexistente")
            return

        user_id = user.id_usuario

        # 4. Validar autorización en el diagrama y proyecto (Propietario o Colaborador activo)
        try:
            diagrama, es_propietario, permiso_edicion = DiagramaService.get_diagrama_permiso(
                db, diagrama_id, user_id
            )
        except HTTPException as he:
            logger.warning(
                f"[WS] Acceso denegado a usuario {user_id} ({user.email}) en diagrama {diagrama_id}: {he.detail}"
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(he.detail))
            return

        # 5. Obtener o crear sesión colaborativa activa en BD
        sesion = ColaboracionService.get_or_create_sesion_activa(
            db, diagrama.id_proyecto, diagrama_id, user_id
        )
        sesion_id = sesion.id_sesion
        codigo_sesion = sesion.codigo_sesion

        # 6. Registrar ingreso del participante en PostgreSQL
        ColaboracionService.registrar_ingreso(db, sesion_id, user_id)

        # 7. Extraer campos de usuario antes de cerrar la sesión de base de datos
        user_info = {
            "id_usuario": user_id,
            "nombre": f"{user.nombre} {user.apellido or ''}".strip(),
            "email": user.email,
            "es_propietario": es_propietario,
            "permiso_edicion": permiso_edicion,
        }

        # Liberar la sesión DB del handshake de inmediato para no mantener transacciones abiertas
        db.close()
        db = None

        # 8. Registrar conexión en el ConnectionManager
        conn_id, is_first_connection = await ws_manager.connect(
            diagrama_id, user_id, user_info, websocket
        )

        # 9. Enviar mensaje inicial de sesión al nuevo socket
        init_payload = {
            "type": "session.init",
            "session_id": sesion_id,
            "session_code": codigo_sesion,
            "diagram_id": diagrama_id,
            "user": user_info,
            "active_participants": ws_manager.get_active_participants(diagrama_id),
            "timestamp": datetime.now().isoformat(),
        }
        await websocket.send_text(json.dumps(init_payload, default=str))

        # 9. Si es la primera conexión del usuario en el diagrama, notificar a los demás
        if is_first_connection:
            join_payload = {
                "type": "presence.join",
                "diagram_id": diagrama_id,
                "user": user_info,
                "timestamp": datetime.now().isoformat(),
            }
            await ws_manager.broadcast_to_diagram(
                diagrama_id, join_payload, exclude_conn_id=conn_id
            )

        # 10. Bucle de recepción de mensajes del cliente
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception:
                continue

            msg_type = msg.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif msg_type in (
                "class.created",
                "class.updated",
                "class.deleted",
                "attribute.created",
                "attribute.updated",
                "attribute.deleted",
                "method.created",
                "method.updated",
                "method.deleted",
                "relation.created",
                "relation.updated",
                "relation.deleted",
                "diagram.update",
            ):
                # Rechazar: Las mutaciones UML NUNCA se admiten por WebSocket directo
                await websocket.send_text(
                    json.dumps({
                        "type": "error",
                        "detail": "Las operaciones sobre el diagrama UML deben realizarse exclusivamente mediante la API REST persistente de CU03.",
                    })
                )

    except WebSocketDisconnect:
        logger.info(f"[WS] Desconexión de cliente {user_id} [conn_id={conn_id}] en diagrama {diagrama_id}")
    except Exception as e:
        logger.error(f"[WS] Error inesperado en WebSocket ({diagrama_id}, {user_id}): {e}")
        try:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Error interno")
        except Exception:
            pass
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

        # 11. Limpieza de desconexión
        if user_id is not None and conn_id is not None:
            is_last = await ws_manager.disconnect(diagrama_id, user_id, conn_id)
            if is_last:
                # Solo cuando el usuario no tiene ninguna otra pestaña/socket activo
                if sesion_id is not None:
                    db_disc = SessionLocal()
                    try:
                        ColaboracionService.registrar_salida(db_disc, sesion_id, user_id, diagrama_id)
                    finally:
                        db_disc.close()

                leave_payload = {
                    "type": "presence.leave",
                    "diagram_id": diagrama_id,
                    "user_id": user_id,
                    "timestamp": datetime.now().isoformat(),
                }
                await ws_manager.broadcast_to_diagram(diagrama_id, leave_payload)
