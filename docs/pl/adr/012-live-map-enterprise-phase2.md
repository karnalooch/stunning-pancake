# ADR 012: Live Map Enterprise — architektura Fazy 2


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / Tech Lead |
| **Last reviewed** | 2026-06-05 |
| **Audience** | Backend, admin frontend, on-call, sprzedaż B2B |
| **lang** | pl |
| **translation** | [English](../../adr/012-live-map-enterprise-phase2.md) |
| **canonical_path** | docs/pl/adr/012-live-map-enterprise-phase2.md |

**Powiązane:** [005-telemetry-tracking.md](./005-telemetry-tracking.md) · [011-telemetry-ingest-durability-under-load.md](./011-telemetry-ingest-durability-under-load.md) · [operations/LIVE_MAP.md](../operations/LIVE_MAP.md)

---

## Status

Zaakceptowano (2026-06-05) — wzorce enterprise i plan dostaw Fazy 2 dla mapy live w panelu admin.

## Kontekst

Mapa live w adminie korzysta z **hot path** (Redis GEO, `TelemetryService`, tick symulatora, SSE/poll). Faza 2 dodaje możliwości **B2B**: izolacja multi-tenant, replay na warm path, operacyjność (audit + webhooki), white-label oraz agregacja przestrzenna przy 10k+ riderów.

Ten ADR opisuje **jak enterprise buduje mapy fleet/live** oraz **jak mapujemy to na stack SPORT** (Django + Redis + rozszerzenie Timescale na istniejącym Postgresie + Celery).

## Podsumowanie decyzji

| Obszar | Wzorzec enterprise | Decyzja SPORT |
|--------|-------------------|---------------|
| Szeregi czasowe | Hot + warm + cold | Redis = live; **Timescale** schema `telemetry` na 30d replay/compare |
| Tenant/dept | Denormalizacja przy ingest; enforcement w API | `tenant_id` + `primary_department_id`; `live_map_rbac.py` |
| Skala LOD | H3/hexbin sterowany serwerem | `GET /telemetry/live/aggregate/`; `meta.render_mode` |
| Alerty | Detektor async + delivery | Kolejka Celery `notifications`; dedupe Redis 10 min |
| Compliance | Audit odsłon mapy | `POST /telemetry/live/audit/` → `AuditLog` |

---

## 1. Dane czasowe (hot / warm / cold)

### Wzorzec branżowy

| Warstwa | Rola | Typowe narzędzia |
|---------|------|------------------|
| **Hot** | Ostatnie sekundy–minuty; mapa live | Redis GEO, Kafka, DynamoDB streams |
| **Warm** | Replay 24h–90d; compare vs wczoraj | TimescaleDB, ClickHouse, BigQuery |
| **Cold** | Analityka roczna; compliance | S3 + Parquet, data lake |

**Jak to robią:**

- **Zapis asynchroniczny** — ingest live nie czeka na DB szeregów czasowych. Worker/kafka consumer batchuje (np. 1–5 s, 500–5000 rekordów).
- **Extension na PG** — typowe u firm 50–500 osób w zespole platformy: jeden Postgres + Timescale, osobny schema `telemetry`, retention policy w TS.
- **Osobna instancja** — gdy telemetry to osobny produkt (Datadog, Uber, delivery): dedykowany klaster TS/ClickHouse, PG tylko OLTP.

**Dodatki enterprise:**

- Continuous aggregates (1min, 1h per tenant/cell)
- Compression po 7 dniach
- Multi-tenant: `tenant_id` w każdym wierszu; polityki dostępu w **API** (RLS opcjonalnie)

### Mapowanie SPORT

```
simulator_live_tick → Redis (hot, bez zmian)
        ↓
Celery Beat (10s) → snapshot_live_positions_to_timescale
        ↓
telemetry.live_position_events (hypertable, retention 30d, compression 7d)
        ↓
GET /telemetry/live/replay/ + /compare/
```

- **Nigdy** nie zapisuj do Timescale na HTTP poll ani SSE.
- Feature flag: `live_map_timescale_writer`.
- `docker-compose.yml` już używa `timescale/timescaledb-ha:pg15-latest`.

**SLO (v1):** live GET p95 &lt; 200 ms; replay p95 &lt; 800 ms (bucket 30s, bbox PL).

---

## 2. Filtr tenant / department

### Wzorzec branżowy

- Przy każdym evencie pozycji dołączają `tenant_id`, `org_id`, `department_id` (snapshot z JWT / profilu).
- **Bez JOIN** do `UserDepartment` na każdym poll mapy.
- **RBAC w warstwie API:**
  - Global admin: opcjonalny filtr `tenant_id`
  - Tenant admin: `tenant_id` wymuszony z tokena
  - Dept manager: `department_id IN (scoped_depts)`

**Ewolucja departmentów:**

| Wersja | Model |
|--------|--------|
| v1 | Jeden `primary_department_id` na ride/sesję |
| v2 | Tablica `department_ids[]` + filtr OR |
| v3 | Drzewo dept — filtr „dział + poddziały” |

**Audyt:** każde zapytanie loguje who + tenant + filtry + `bbox_hash` (SOC2/GDPR).

### Mapowanie SPORT

**Denormalizacja przy ingest** (`users/departments.py`, `simulator_live_tick.py`, `TelemetryService._encode_entry`):

- `ride_scope_from_user(user)` → `{tenant_id, primary_department_id}`
- Zapis na ride w Redis i w JSON telemetry (`tenantId`, `departmentId`)

**Enforcement API** (`live_map_rbac.py`, `live_map_api.py`):

| Rola | `tenant_id` | `department_id` |
|------|-------------|-----------------|
| `GLOBAL_OWNER` | opcjonalny query | opcjonalny (walidacja) |
| `TENANT_ADMIN` / `TENANT_MODERATOR` | wymuszony z usera | opcjonalny, w scope tenantu |
| Moderator działu | wymuszony tenant | IN `moderated_departments` |

**Meta:** `filters_applied`, `viewport_total_before_filter`, `viewport_filtered_out`.

---

## 3. Agregacja przestrzenna przy skali (H3 / hexbin)

### Wzorzec branżowy (Uber, Mapbox, fleet)

```
zoom out / duża liczba  →  kafelki zagregowane (H3)
zoom in / mała liczba   →  klastry lub punkty
```

- **H3** (Uber) lub **S2** (Google) przy skali globalnej.
- **Hexbin prostokątny** — dashboardy jednego miasta, szybkie MVP.
- **Vector tiles (MVT)** — przy bardzo dużej skali.

**Typowe progi:**

| Viewport | Tryb |
|----------|------|
| &lt; 2k punktów | Punkty / klastry |
| 2k–10k | Większe klastry, bez etykiet |
| &gt; 10k lub estimate ≫ returned | Tylko heatmapa komórkowa |

**Zasada enterprise:** decyzja na serwerze; klient tylko rysuje warstwę fill. **`meta.capped`** steruje trybem, nie tylko badge.

### Mapowanie SPORT

- `GET /activities/telemetry/live/aggregate/` — `mode=h3|hexbin`, bbox, filtry tenant/dept.
- Źródło live: Redis; historia: continuous aggregate w TS.
- Cache Redis: `{livemap}:agg:{bbox_hash}:{res}:{tenant}:{dept}` TTL 5–15 s.
- Fallback hexbin z `heatmap.py` gdy brak `h3-py`.
- Meta live: `render_mode`, `aggregate_url`.
- Przełączenie przy `viewport_total_estimate >= 10_000` lub `positions_returned >= 2000 && capped`.
- Feature flag: `live_map_h3_aggregate`.

---

## 4. Webhooki i alerty

### Wzorzec branżowy

```
Detector (edge) → Kolejka zdarzeń → Worker dostaw → Webhook / PagerDuty / Slack
                      ↓
                 Dedupe (Redis)
```

- **Nigdy sync** w HTTP request od użytkownika mapy.
- **Detector** — hysteresis, cooldown 5–15 min.
- **Delivery** — Celery, retry exponential, HMAC, DLQ.
- **Idempotency-Key** — ten sam `event_id`.

| Event | Znaczenie |
|-------|-----------|
| `ingest_lag` | Pipeline opóźniony |
| `viewport_saturated` | Cap próbkowania |
| `anomaly_spike` | Skok flagged |
| `sla_breach` | Mapa stale &gt; X s |

### Mapowanie SPORT

Wzorzec jak `rewards/stripe_service.py`:

- Model `LiveMapAlertWebhook`
- `evaluate_live_map_alerts(meta, tenant_id)` — Celery po writerze lub Beat 60 s
- Dedupe: `livemap:alert:{tenant}:{event}:{bucket_10min}` TTL 600 s
- Kolejka **`notifications`**, nagłówki `X-LiveMap-Signature`, `X-Event-Id`
- Feature flag: `live_map_webhooks`

---

## 5. Architektura end-to-end

Patrz diagram w wersji angielskiej: [012-live-map-enterprise-phase2.md](../../adr/012-live-map-enterprise-phase2.md).

### Co odróżnia „enterprise” od „działa u nas”

1. **Izolacja multi-tenant** — wymuszona w API, nie tylko w UI.
2. **Uczciwa degradacja** — przy capie aggregate, nie pusta mapa.
3. **Operacyjność** — replay, compare, webhooki, audit.
4. **SLO** — live p95 &lt; 200 ms; replay async; alerty z cooldown.

---

## 6. Kolejność wdrożenia

| Priorytet | Milestone | Dostawa |
|-----------|-----------|---------|
| P0 | M1 | Filtr tenant/dept E2E |
| P1 | M2 | Writer TS + replay 30d |
| P1 | M3 | Compare wczoraj + scrubber serwerowy |
| P1 | M4 | Audit + webhooki v1 |
| P2 | M5 | Kolory klastrów z `map_theme` |
| P2 | M6 | H3 aggregate + auto LOD |

**Feature flags:** `live_map_timescale_writer`, `live_map_server_replay`, `live_map_h3_aggregate`, `live_map_webhooks`.

---

## 7. Poza scope Fazy 2

- Cold path S3/Parquet
- Multi-dept OR (v2)
- Drzewo departmentów (v3)
- MVT vector tiles
- Integracja Datadog

---

## 8. Status implementacji

| Komponent | Status |
|-----------|--------|
| `live_map_rbac.py` + filtr w API | ✅ Dostarczone |
| Denormalizacja ride/telemetry | ✅ Dostarczone |
| Hypertable Timescale + writer | 🔲 Planowane |
| Replay / compare API + UI | 🔲 Planowane |
| Audit POST | 🔲 Planowane |
| Webhooki | 🔲 Planowane |
| White-label `map_theme` | 🔲 Planowane |
| H3 aggregate + LOD | 🔲 Planowane (stub `render_mode` w meta) |
