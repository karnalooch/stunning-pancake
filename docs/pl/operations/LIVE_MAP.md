# Live Map — operacje i standard enterprise

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / Admin Owner |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Operatorzy, on-call, maintainerzy frontendu |
| **lang** | pl |
| **translation** | [English](../../en/operations/LIVE_MAP.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/LIVE_MAP.md |

**Kod:** `admin/src/modules/analytics/LiveMap.tsx`, moduły `liveMap*`, API `GET /api/activities/telemetry/live/`

## Cele jakościowe

| Obszar | Implementacja |
|--------|----------------|
| **LOD / zoom** | `liveMapZoom.ts`, `liveMapLayers.ts`, audyt `admin/scripts/audit-live-map-lod.mjs` |
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
