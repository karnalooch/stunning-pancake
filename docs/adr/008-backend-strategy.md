# ADR 008: Backend Integration Strategy (Power Couple)

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |


## Status
Accepted (2026-05-13)

## Context
The SPORT platform needs to handle both high-frequency telemetry ingestion and complex business logic (users, activities, leaderboards, AI coaching).

## Decision
We adopted the **"Power Couple" Strategy**:

### Core Pillars
1. **Python Ecosystem (Backend)**: Django is our source of truth for user data and security. We leverage its ORM for complex relationships and its AI-readiness for orchestrating Gemini/GPT models.
2. **TypeScript Ecosystem (Frontend)**: React Native (Mobile) and React (Admin) handle all user interactions.
3. **LLM Proxying**: Mobile clients NEVER call OpenAI/Gemini APIs directly in production. All requests are routed through a Python proxy (`/api/llm/proxy/`). This allows us to:
    - Rotate API keys without pushing app updates.
    - Implement server-side content filtering.
    - Inject secret system prompts that shouldn't be exposed in the mobile bundle.
4. **Telemetry Segregation**: Telemetry data (GPS, HR) is pushed to a high-throughput FastAPI service optimized for TimescaleDB, preventing heavy ingest loads from slowing down the main Django business API.

## Consequences
- **Positive**: Enhanced Security. API keys are strictly server-side.
- **Positive**: Data Integrity. Shared JSON schemas ensure that a "Ride" object looks identical in Python and TypeScript.
- **Negative**: DevOps Overhead. Deploying both a Django monolith and a FastAPI telemetry stream requires robust container orchestration (Docker Compose / Kubernetes).
