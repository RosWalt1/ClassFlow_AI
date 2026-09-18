import asyncio
import json
import logging
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Gestiona conexiones WebSocket activas organizadas por salas de diagrama.
    Estructura:
    diagram_rooms[diagrama_id][usuario_id] = {
        "user_info": { "id_usuario": int, "nombre": str, "email": str, "rol": str, "permiso_edicion": bool },
        "sockets": { connection_id: WebSocket }
    }
    Garantiza:
    - Múltiples pestañas/conexiones simultáneas para un mismo usuario sin duplicar participantes.
    - Emisión de presence.leave únicamente cuando se cierra el ÚLTIMO socket de ese usuario.
    - Aislamiento estricto de eventos por diagrama.
    - Thread-safety robusto usando threading.Lock para soportar múltiples bucles/hilos de prueba o servidores.
    """

    def __init__(self):
        self._rooms: Dict[int, Dict[int, Dict[str, Any]]] = {}
        self._lock = threading.Lock()
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._main_loop = loop

    async def connect(
        self,
        diagrama_id: int,
        user_id: int,
        user_info: Dict[str, Any],
        websocket: WebSocket,
    ) -> Tuple[str, bool]:
        """
        Registra una conexión WebSocket.
        Retorna (connection_id, is_first_connection).
        is_first_connection es True solo si el usuario no tenía ningún otro socket abierto en este diagrama.
        """
        conn_id = str(uuid.uuid4())
        await websocket.accept()

        try:
            self._main_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

        with self._lock:
            if diagrama_id not in self._rooms:
                self._rooms[diagrama_id] = {}

            user_entry = self._rooms[diagrama_id].get(user_id)
            is_first_connection = user_entry is None or len(user_entry.get("sockets", {})) == 0

            if user_entry is None:
                self._rooms[diagrama_id][user_id] = {
                    "user_info": user_info,
                    "sockets": {},
                }

            self._rooms[diagrama_id][user_id]["user_info"] = user_info
            self._rooms[diagrama_id][user_id]["sockets"][conn_id] = websocket

        logger.info(
            f"[WS] Usuario {user_id} ({user_info.get('nombre')}) conectado al Diagrama {diagrama_id} "
            f"[conn_id={conn_id}]. Primera conexión: {is_first_connection}"
        )
        return conn_id, is_first_connection

    async def disconnect(
        self,
        diagrama_id: int,
        user_id: int,
        conn_id: str,
    ) -> bool:
        """
        Remueve una conexión WebSocket específica.
        Retorna True si fue la última conexión del usuario en el diagrama (is_last_connection),
        indicando que ahora está completamente desconectado.
        """
        with self._lock:
            room = self._rooms.get(diagrama_id)
            if not room or user_id not in room:
                return False

            user_entry = room[user_id]
            user_entry["sockets"].pop(conn_id, None)

            if len(user_entry["sockets"]) == 0:
                room.pop(user_id, None)
                if len(room) == 0:
                    self._rooms.pop(diagrama_id, None)
                logger.info(
                    f"[WS] Usuario {user_id} cerró su ÚLTIMA conexión en Diagrama {diagrama_id}."
                )
                return True

            logger.info(
                f"[WS] Usuario {user_id} cerró conexión {conn_id} en Diagrama {diagrama_id}, "
                f"pero aún conserva {len(user_entry['sockets'])} conexión(es) activa(s)."
            )
            return False

    async def broadcast_to_diagram(
        self,
        diagrama_id: int,
        event: Dict[str, Any],
        exclude_conn_id: Optional[str] = None,
    ) -> None:
        """
        Envía un evento a todas las conexiones activas en la sala del diagrama indicado.
        Garantiza aislamiento: jamás envía a conexiones de otros diagramas.
        """
        target_sockets: List[Tuple[int, str, WebSocket]] = []

        with self._lock:
            room = self._rooms.get(diagrama_id)
            if not room:
                return
            for uid, user_entry in room.items():
                for cid, ws in user_entry["sockets"].items():
                    if exclude_conn_id and cid == exclude_conn_id:
                        continue
                    target_sockets.append((uid, cid, ws))

        if not target_sockets:
            return

        json_text = json.dumps(event, default=str)
        dead_connections: List[Tuple[int, str]] = []

        for uid, cid, ws in target_sockets:
            try:
                await ws.send_text(json_text)
            except Exception as e:
                logger.warning(
                    f"[WS] Error enviando a {uid} [conn_id={cid}] en diagrama {diagrama_id}: {e}"
                )
                dead_connections.append((uid, cid))

        if dead_connections:
            with self._lock:
                room = self._rooms.get(diagrama_id)
                if room:
                    for uid, cid in dead_connections:
                        if uid in room and cid in room[uid]["sockets"]:
                            room[uid]["sockets"].pop(cid, None)
                            if len(room[uid]["sockets"]) == 0:
                                room.pop(uid, None)
                    if len(room) == 0:
                        self._rooms.pop(diagrama_id, None)

    def get_active_participants(self, diagrama_id: int) -> List[Dict[str, Any]]:
        """
        Retorna la lista de usuarios participantes actualmente conectados al diagrama.
        Sin duplicados por usuario.
        """
        with self._lock:
            room = self._rooms.get(diagrama_id, {})
            return [entry["user_info"] for entry in room.values()]

    def is_user_connected(self, diagrama_id: int, user_id: int) -> bool:
        """Indica si el usuario tiene al menos un socket activo en el diagrama."""
        with self._lock:
            room = self._rooms.get(diagrama_id, {})
            return user_id in room and len(room[user_id]["sockets"]) > 0

    def get_user_connection_count(self, diagrama_id: int, user_id: int) -> int:
        """Retorna la cantidad de sockets activos que el usuario tiene en el diagrama."""
        with self._lock:
            room = self._rooms.get(diagrama_id, {})
            if user_id in room:
                return len(room[user_id]["sockets"])
            return 0

    def broadcast_sync(
        self,
        diagrama_id: int,
        event: Dict[str, Any],
        exclude_conn_id: Optional[str] = None,
    ) -> None:
        """
        Versión síncrona y segura de broadcast_to_diagram para invocarse desde
        endpoints REST tras un db.commit() confirmado en PostgreSQL.
        """
        with self._lock:
            if diagrama_id not in self._rooms or len(self._rooms[diagrama_id]) == 0:
                return

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = self._main_loop

        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_diagram(diagrama_id, event, exclude_conn_id),
                loop,
            )
        else:
            try:
                new_loop = asyncio.new_event_loop()
                new_loop.run_until_complete(
                    self.broadcast_to_diagram(diagrama_id, event, exclude_conn_id)
                )
                new_loop.close()
            except Exception as e:
                logger.warning(f"[WS] Error en broadcast_sync fallback: {e}")


# Instancia singleton global del ConnectionManager
ws_manager = ConnectionManager()
