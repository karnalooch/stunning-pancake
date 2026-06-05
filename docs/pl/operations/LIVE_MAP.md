# Live Map — operacje i standard enterprise

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / Admin Owner |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Operatorzy, on-call, maintainerzy frontendu |
| **lang** | pl |
| **translation** | [English](../../en/operations/LIVE_MAP.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/LIVE_MAP.md |

**Kod:** `admin/src/modules/analytics/LiveMap.tsx`, moduły `liveMap*`, API `GET /api/activities/telemetry/live/`

## Enterprise LOD (3 tiery)

| Tier | Zoom | API `detail` | Warstwy |
|------|------|--------------|---------|
| **Makro** | z &lt; 9 | `summary` | Huby miast (`city_counts`) |
| **Meso** | 9 ≤ z &lt; 12 | `standard` | Klastry Supercluster |
| **Mikro** | z ≥ 12 | `full` | Ikony + etykiety GPU |

Kod: `liveMapEnterprise.ts`, `liveMapZoom.ts`, `liveMapLayers.ts` (`minzoom` per tier).

Nagłówek: **active** (global FSM) + **in view** (`positions_returned` w bbox).

## Cele jakościowe

| Obszar | Implementacja |
|--------|----------------|
| **LOD / zoom** | `liveMapEnterprise.ts`, `liveMapZoom.ts`, `liveMapLayers.ts` |
| **Płynność ruchu** | `liveMapInterp.ts` — blend + ekstrapolacja między pollami |
| **Viewport** | `liveMapViewport.ts` — cache bust `refresh`, brak stale markerów po zoomie |
| **Sync health** | `liveMapHealth.ts`, `LiveMapStatusBar.tsx` — Live / Stale / Degraded / Error / Paused |
| **Polling SLO** | `liveMapPoll.ts` — hint `poll_after_ms` z API, jitter, backoff po błędach |
| **Ochrona ingest** | ADR 011 — `live_map_read_policy()`, badge + tryb degraded |

## Transport

| Tryb | Endpoint | Cadence |
|------|----------|---------|
| **Widok kraj (z ≥ 5)** | Huby miast z liczbą + klastry (`detail=standard`, limit ~800) | — |
| **SSE (domyślny, z ≥ 5)** | `GET /api/activities/telemetry/live/stream/` | 200–500 ms (`stream_interval_ms` w meta) |
| **HTTP poll (fallback)** | `GET /api/activities/telemetry/live/` | ≥ 950 ms przy zoom ≥ 12; wolniejszy gdy SSE aktywny (~15 s) |
| **WS (opcjonalny)** | FastAPI `/ws/telemetry/live` | `position_update` z ingest — `VITE_LIVE_MAP_WS=1` |

Ruch na mapie: **ring buffer 3 punkty / device** + interpolacja po **polilinii** (`liveMapRing.ts`, `liveMapPolyline.ts`).

## API `telemetry/live`

| Parametr | Opis |
|----------|------|
| `bbox` | `west,south,east,north` (+22% padding po stronie klienta) |
| `zoom` | Zoom MapLibre (zaokrąglony) |
| `detail` | `summary` \| `standard` \| `full` |
| `limit` | Cap pozycji (0 przy summary) |
| `refresh` | Niepuste → pomija Redis cache odpowiedzi |
| `tenant_id` / `tenant` | Filtr tenantu (GLOBAL_OWNER); wymuszony dla TENANT_ADMIN |
| `department_id` / `department` | Filtr działu (w scope tenantu) |

### Meta (enterprise)

| Pole | Znaczenie |
|------|-----------|
| `poll_after_ms` | Sugerowany odstęp HTTP polla (ms); ≥12: ~950 ms |
| `stream_interval_ms` | Cadence SSE (ms); ≥12: ~350 ms |
| `read_mode` | `normal` \| `ingest_protected` \| `viewport_capped` \| `cached` |
| `server_time` | Unix timestamp odpowiedzi |
| `live_detail_ceiling` | Przy ingest: max `detail` |
| `ingest_engaged` | ADR 011 — throttling aktywny |
| `capped` | GEORADIUS zwrócił więcej niż limit viewport |
| `city_counts` | Huby miast (summary / region) |
| `filters_applied` | Aktywne filtry tenant/dept/activity/city |
| `viewport_filtered_out` | Pozycje odrzucone przez RBAC tenant/dept |
| `render_mode` | `points` \| `clusters` \| `aggregate` (LOD przy skali) |
| `aggregate_url` | URL H3/hexbin gdy `render_mode=aggregate` |
| `timescale_available` | Warm path (replay serwerowy) dostępny |

### Replay (warm path)

| Endpoint | Parametry |
|----------|-----------|
| `GET /api/activities/telemetry/live/replay/` | `from`, `to` (ISO), `step` (5s/30s/60s), `bbox`, filtry tenant/dept |
| `GET /api/activities/telemetry/live/replay/compare/` | jak wyżej + `compare_offset=24h` (domyślnie) |

Writer: Celery Beat co **10 s** → `activities.tasks.snapshot_live_positions_to_timescale` (feature flag `live_map_timescale_writer`).

### Audit i webhooki (F3)

| Endpoint | Opis |
|----------|------|
| `POST /api/activities/telemetry/live/audit/` | `LIVE_MAP_VIEW` — debounced 1/30s per session+bbox |
| `GET/POST /api/activities/telemetry/live/webhooks/` | Konfiguracja webhooków per tenant |
| `POST .../webhooks/<id>/test/` | Test ping (`test_ping`) |

Detector: Celery Beat co **60 s** (`evaluate_live_map_alerts`), dostawa na kolejce `notifications`, dedupe Redis 10 min.

## Enterprise Phase 2 (B2B)

Pełna architektura wzorców branżowych (hot/warm/cold, RBAC, H3, webhooki, audit) — **[ADR 012](../../adr/012-live-map-enterprise-phase2.md)**.

| Faza | Status | Opis |
|------|--------|------|
| F1 Multi-tenant | ✅ | `live_map_rbac.py`, denormalizacja `tenantId`/`departmentId` |
| F2 Timescale replay | ✅ | Hypertable `telemetry.live_position_events`, writer Celery 10s, `/replay/` |
| F3 Audit + webhooki | ✅ | `LIVE_MAP_VIEW`, `LiveMapAlertWebhook`, Celery delivery |
| F4 White-label | ✅ | `Tenant.map_theme`, `liveMapTheme.ts`, layer v3 |
| F5 H3 aggregate | ✅ | `/aggregate/`, `liveMapH3Layer`, auto LOD |

## Stany UI (`data-sync-status`)

- **connecting** — mapa lub pierwszy fetch
- **live** — synchronizacja < 12 s, bez degradacji
- **degraded** — ingest, cap viewport lub cache
- **stale** — brak udanego fetcha > 12 s
- **error** — błędy sieci/API (z przyciskiem Odśwież)
- **paused** — 401/403 lub brak sesji
- **offline** — karta w tle

## Runbook

### Pusta mapa po zoomie na miasto

1. Sprawdź badge sync (prawy dolny róg).
2. Oddal i przybliż — `zoomend` wymusza fetch z `refresh`.
3. DevTools → odpowiedź `positions` i `meta.capped`.

### „Ingest load” / degraded

- Oczekiwane przy burst ingest (ADR 011).
- Env: `LIVE_MAP_INGEST_CAP_RATIO`, `LIVE_MAP_INGEST_POLL_RATIO`, `LIVE_MAP_INGEST_CACHE_TTL`.

### Sesja paused

- Zaloguj ponownie do panelu admin; mapa wznawia poll po `isAuthenticated`.

### Mapa szara (kafelki)

- Status „Mapa niedostępna” → **Ponów ładowanie** lub CDN OpenFreeMap.

## Testy

```bash
cd admin
npx vitest run src/__tests__/liveMapHealth.test.ts src/__tests__/liveMapPoll.test.ts src/__tests__/liveMapViewport.test.ts src/__tests__/liveMapZoom.test.ts
npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
```

## Powiązane dokumenty

- [SIMULATOR.md](./SIMULATOR.md) — zoom tiers, E2E screenshoty
- [TELEMETRY_LOAD_TEST.md](./TELEMETRY_LOAD_TEST.md) — p95 live read
- [ADR 011](../../adr/011-telemetry-ingest-durability-under-load.md) — read shedding
- [ADR 012](../../adr/012-live-map-enterprise-phase2.md) — enterprise Phase 2 (Timescale, RBAC, H3, webhooki)
