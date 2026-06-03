# SPECYFIKACJA API & STANDARDY TECHNICZNE — v0.1.0-beta.2

| | |
|--|--|
| **Status** | 📦 Deprecated |
| **Last reviewed** | 2026-06-03 |
| **Redirect** | [API.md](../API.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) |

> Historyczna spec v0.1 — nie edytuj; aktualne API w [API.md](../API.md).

## 1. Standardy Komunikacji
- **REST API**: Django REST Framework (DRF) dla danych relacyjnych.
- **Streaming**: WebSocket (FastAPI) dla Live-Ghost i telemetrii — dev only, nie na produkcji.
- **Wersjonowanie**: URL-based (np. `/api/v1/`).
- **Format**: JSON (MF-JSON dla danych OGC).

## 2. Architektura Backend

### Django Core (port 8000) — ✅ Produkcja
- Auth: SimpleJWT (Bearer token, 60min access, 30d refresh)
- RBAC: 5 ról (GLOBAL_OWNER, TENANT_ADMIN, MODERATOR, SPONSOR, ATHLETE)
- RLS: PostgreSQL Row Level Security per tenant
- LLM Proxy: `/api/llm/proxy/` (API key server-side only)
- Anti-Cheat: Warstwy 1-2 synchronicznie (Kinematic Gate, V-max)

### FastAPI Telemetry (port 8001) — ⚠️ Dev only
- High-throughput GPS ingestion
- WebSocket broadcast dla admin dashboard
- Oddzielny mikroserwis, nie zintegrowany z produkcją

## 3. Modelowanie Danych Sportowych
Kluczowe encje i ich rola:
- **User**: Tożsamość, rola, tenant, profil biomechaniczny.
- **Tenant**: Konfiguracja White-Label, branding, limity.
- **Activity**: Ślad GPS zweryfikowany przez Anti-Cheat.
- **Event**: Wydarzenie z geofencem i regułami punktacji.
- **POI/Voucher**: Punkty zainteresowania i system nagród.

## 4. Algorytmy i Formuły
- **Predykcja (Riegel)**: `T2 = T1 * (D2/D1)^1.06` (Bieg).
- **Obciążenie (ACWR)**: Stosunek obciążenia ostrego (7 dni) do chronicznego (28 dni).
- **Anti-Cheat (Warstwa 3-4)**: BRouter map-matching + Viterbi HMM — kod istnieje, dev only.

## 5. OGC API — Moving Features
Wspieramy standard OGC dla wymiany danych przestrzennych:
- `GET /api/ogc/collections/{id}/items/` -> MF-JSON trajektorie.
