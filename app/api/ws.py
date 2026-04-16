"""
app/api/ws.py — WebSocket progress endpoint.

Subscribes to Redis pub/sub channel `sim_progress:{run_id}` and forwards
JSON progress events to the connected WebSocket client.

Event shape:
    {"run_id": "...", "progress": 0.0-1.0, "message": "..."}

Client can send "ping" to get a pong back (liveness check).
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])
_log = logging.getLogger(__name__)


@router.websocket("/ws/simulations/{run_id}/progress")
async def simulation_progress(websocket: WebSocket, run_id: str) -> None:
    """
    Stream simulation progress for run_id via Redis pub/sub.

    Falls back to a polling-hint message if Redis is unavailable.
    """
    await websocket.accept()

    try:
        import redis.asyncio as aioredis
        from app.config import settings

        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        channel = f"sim_progress:{run_id}"
        await pubsub.subscribe(channel)

        async def _stream_redis() -> None:
            """Read Redis pub/sub messages and forward to WebSocket."""
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                raw = message["data"]
                try:
                    payload = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    payload = {"run_id": run_id, "message": str(raw)}

                await websocket.send_json(payload)

                # Close stream when simulation completes or fails
                progress = payload.get("progress", 0.0)
                msg = payload.get("message", "")
                if progress >= 1.0 or "failed" in msg or "done" in msg:
                    break

        async def _handle_client() -> None:
            """Handle incoming client messages (ping/pong)."""
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_json({"pong": True, "run_id": run_id})

        # Run both coroutines; stop when either finishes
        stream_task = asyncio.create_task(_stream_redis())
        client_task = asyncio.create_task(_handle_client())
        done, pending = await asyncio.wait(
            [stream_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        await pubsub.unsubscribe(channel)
        await r.aclose()

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        _log.warning("WebSocket/Redis error for run %s: %s", run_id, exc)
        # Fallback: send a single hint so client knows to poll instead
        try:
            await websocket.send_json({
                "run_id": run_id,
                "progress": 0.0,
                "message": "Streaming unavailable — poll GET /api/v1/simulations/{run_id} for status",
            })
        except Exception:
            pass
