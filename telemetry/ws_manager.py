"""WebSocket connection pool for live map broadcast."""

from __future__ import annotations

import asyncio

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, payload: dict) -> None:
        if not self._connections:
            return
        tasks = [ws.send_json(payload) for ws in self._connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        dead = [ws for ws, res in zip(self._connections, results) if isinstance(res, Exception)]
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
