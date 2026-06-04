"""
FastAPI Telemetry Microservice — SPORT Platform
================================================
Constitution §24.1: Telemetry Zone (FastAPI + Async)

Run (dev):
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload

Module layout (quality refactor):
    config, schemas, db, privacy, ws_manager, ingest_service, bridges, routes, lifecycle
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ingest_auth import IngestJwtMiddleware
from lifecycle import lifespan
from routes import router

logger = logging.getLogger("telemetry")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="SPORT Telemetry Engine",
    description="High-performance GPS ingestion and live broadcast service (Constitution §24.1)",
    version="1.2.0",
    docs_url="/api/telemetry/docs",
    openapi_url="/api/telemetry/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(IngestJwtMiddleware)

app.include_router(router)

# Backward-compatible exports for tests and uvicorn (main:app)
from ingest_service import is_duplicate_batch as _is_duplicate_batch  # noqa: E402
from routes import ingest_batch  # noqa: E402
from schemas import BatchPacket, GpsPacket  # noqa: E402

__all__ = [
    "app",
    "GpsPacket",
    "BatchPacket",
    "_is_duplicate_batch",
    "ingest_batch",
]
