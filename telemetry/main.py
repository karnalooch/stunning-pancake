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

from log_redaction import install_log_redaction

# Install T71 redaction before importing telemetry modules that can emit runtime logs.
install_log_redaction()

from durable_routes import ingest_batch_durable, router as durable_router
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

# P3 durable batch handler must be registered before the legacy telemetry
# router so the pilot path receives transactional DB receipts for every ACK.
app.include_router(durable_router)
app.include_router(router)

# Backward-compatible exports for tests and uvicorn (main:app)
from ingest_service import is_duplicate_batch as _is_duplicate_batch  # noqa: E402
from schemas import BatchPacket, GpsPacket  # noqa: E402

ingest_batch = ingest_batch_durable

__all__ = [
    "app",
    "GpsPacket",
    "BatchPacket",
    "_is_duplicate_batch",
    "ingest_batch",
]
