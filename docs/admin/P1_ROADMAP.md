# P1 — Roadmap panelu admin (decyzje 2026-06-03)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/admin/P1_ROADMAP.md) |
| **canonical_path** | docs/admin/P1_ROADMAP.md |

---

| | |
|--|--|
| **Status** | ✅ Active — Paczka **1a** + **1b** (core ✅); **operational gate** przed Paczką **2** Sponsor |
| **Główny użytkownik** | `GLOBAL_OWNER` |
| **Post-deploy gate** | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |
| **Operacje Railway** | [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1` |
| **Audyt UI (snapshot)** | [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) |

---

## 1. Decyzje z Q&A (skrót)

| Temat | Decyzja |
|-------|---------|
| Zakres P1 | Wszystkie obszary P1 **sekwencyjnie** (paczki 1→6) |
| Użytkownik startowy | **GLOBAL_OWNER** (codzienny simulator) |
| Simulator | **Paczka 1** — pierwsza, codzienne użycie |
| Sponsor | **Paczka 2** — **następna** (po domknięciu 1b operacyjnie) |
| Tenant Admin | **Paczka 4** — za ~1 tydzień |
| Auth / 2FA | **[P2_ROADMAP.md](./P2_ROADMAP.md)** § Auth (było Paczka 6) |
| GPX / forensics | **[P2_ROADMAP.md](./P2_ROADMAP.md)** §2 GPX (F1–F6 + checklista §2.3) — **nie** Paczka 1c |
| Moderatorzy | **Paczka 5** |
| RAM / Railway | **10D** — SSOT [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) |
| Deploy | **11C** — brak stagingu → §4 |
| Tryb pracy | Dokument + wdrożenie od razu |

### Kolejność paczek (8A)

1. **Simulator + skala** — 1a ✅ · 1b ✅ (core) · load-test telemetry 🟧 · operational gate 🚧  
2. **Sponsor** (Paczka 2) — **teraz (product)**  
3. **GO tooling** (Paczka 3)  
4. **Tenant Admin** (Paczka 4)  
5. **Moderator queue** (Paczka 5)  
6. **Auth** (Paczka 6) — szczegóły w [P2_ROADMAP.md](./P2_ROADMAP.md) § Auth/MFA

---

## 2. Paczka 1 — Simulator + skala

### Paczka 1a ✅ (wdrożone 2026-06-03)

| Element | Status |
|---------|--------|
| FSM jazdy w Redis (`PENDING_ROUTE` … `FAILED_UNROUTABLE`) | ✅ |
| Kolejka Celery `routing` + `route_live_ride_task` | ✅ |
| Live tick — tylko `ACTIVE`; starty → `PENDING_ROUTE` + dispatch | ✅ |
| API: `ride_warming`, `ride_routing`, `async_routing_enabled`, … | ✅ |
| UI Simulator — badge Warming / Routing / Queued | ✅ |
| Logi: throttle island; `sim.routing.unroutable` / `sim.routing.error` | ✅ |
| Railway: dokumentacja + worker `celery-worker-routing` | ✅ |
| Testy: FSM + routing queue + status API | ✅ |

**Weryfikacja prod (Platform Operator):**

1. `.\scripts\railway-verify-production.ps1` → PASS  
2. Logi `celery-worker-routing`: `routing@`, brak Expo  
3. Live sim: `ride_warming` → spadek po rozgrzaniu tras  

Szczegóły env/RAM: [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md).

### Paczka 1b ✅ (core 2026-06-03) · operational gate 🚧

| Element | Status |
|---------|--------|
| Backpressure kolejki `routing` | ✅ `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH`, per-tick cap, API + log `sim.routing.backpressure` |
| Dashboard KPI „sim ON” | ✅ sekcja **Live Simulator** na Dashboard GO (`sim_kpi` w `/admin/stats/`) |
| Simulator page — queue KPI | ✅ `routing_queue_depth`, backpressure, throttled (live-simulate API) |
| Live Map + FSM | ✅ `active_riding` / `ride_on_map` = ACTIVE; `city_counts` FSM; `ride_state` w payload; badge warming |
| Load-test 10k | ✅ szablon + lokalny ingest/map — [TELEMETRY_LOAD_TEST.md](../operations/TELEMETRY_LOAD_TEST.md) · 50k sustained **odroczone** |
| Metryki Datadog | ✅ log keys — [DATADOG_SIMULATOR.md](../operations/DATADOG_SIMULATOR.md) |
| Testy pytest (backpressure + status + routing) | ✅ `-m simulator_light` via `run_pytest.py` |
| Enterprise: markery `simulator_light` / `simulator_integration` + CI | ✅ `pyproject.toml`, `run_pytest.py`, Redis db/15 w CI |

#### Operational closure (przed Paczką 2 Sponsor)

| # | Kryterium | Status |
|---|-----------|--------|
| 1 | `python run_pytest.py … -m simulator_light` — PASS lokalnie / CI | ✅ 31/31 (2026-06-03) |
| 2 | `.\scripts\railway-verify-production.ps1` — PASS (jeśli `RAILWAY_API_TOKEN`) | ✅ PASS 22/22 (2026-06-03, push `b9652e24`) |
| 3 | P0 smoke GO — [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) | 🟡 częściowo (2026-06-04) — **infra PASS:** `railway-verify-production.ps1` 22/22, `audit-prod-health.ts` 16/16 (0 down, 0×5xx), `/health/`→200, Admin SPA→200, API admin→401 (poprawny guard). **Brakuje** ról UI (GLOBAL_OWNER/TENANT_ADMIN/MODERATOR/SPONSOR) — wymaga interaktywnego logowania; znany test admin `global_owner` istnieje na prod |
| 4 | Live sim: `ride_warming` → spadek; `routing_queue_depth` stabilne przy `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | 🟡 **poprawa** (2026-06-04, calm restart) — `active_ratio=0.08`, `tick_seconds=10`, POST po `simulator-reset` (wipe utknął 60%); **17 min** obserwacji: `running=True`, `ride_warming` **90→84**, `routing_queue_depth` **60→90→84** (powoli spada, nadal **> cap 80**), `currently_riding=21`. **Bez ✅** — kolejka jeszcze nad progiem. |
| 5 | Load-test 10k — wypełniony szablon metryk w SCALE_TEST_300K (bez prod 10k bez zgody) | ✅ (2026-06-04) — szablon + lokalny harness; **prod 50k odroczony** |
| 6 | Logi prod: brak lawiny `sim.routing.backpressure` >15 min przy normalnym `active_ratio` | 🟡 **poprawa** (2026-06-04, calm restart) — przy **0.08** backpressure **aktywny** (`depth≥80`), throttled **30/tick**, logi simulation **~6/min** w oknie T+5…T+14 (mniej niż przy 0.10), po **17 min** sim stabilny. **Bez ✅** — nadal throttling przy cap=80. |

---

## 3. Paczka 2 — Sponsor (portal partnera) — **NEXT product**

**Cel:** `SPONSOR` widzi Vouchers + Analytics; sensowne empty state.

| Kryterium |
|-----------|
| Nav: Sponsor Dashboard, POI, Vouchers, Analytics dla `SPONSOR` |
| Puste stany z CTA „Create first voucher” / link POI |
| API sponsor scope — tylko własny tenant |

**Gate przed startem:** P0 smoke GO dla ról dotkniętych nav ([P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md)).

---

## 4. Paczki 3–6 (skrót)

Szczegóły bez zmian merytorycznych — patrz poprzednia wersja dokumentu:

- **Paczka 3** — health strip GO, drill-down tenant  
- **Paczka 4** — `TENANT_ADMIN` scoped IA  
- **Paczka 5** — unified moderator inbox; fix `ModeratorWorklist` tenantId  
- **Paczka 6** — MFA, impersonation audit → pełny scope: [P2_ROADMAP.md](./P2_ROADMAP.md) § Auth/MFA  

### Odłożone do P2 (nie P1)

| Temat | Dokument |
|-------|----------|
| GPX: on-demand, S3, anty-cheat, forensics, RODO ZIP, retencja, import (F6) | [P2_ROADMAP.md](./P2_ROADMAP.md) §2 — **pełna checklista** §2.3 |

**Uwaga:** „P2” w nazewnictwie to **osobny tor roadmapy** ([P2_ROADMAP.md](./P2_ROADMAP.md)), nie skrót od „Paczka 2 Sponsor”.

---

## 5. RAM 10D — rekomendacje (skrót)

Pełna tabela: [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md).

| Serwis | RAM | Uwagi |
|--------|-----|--------|
| `celery-worker-simulation` | **≥ 2 GB** | `solo`; nie prefork 6–7 @ 512 MB |
| `celery-worker-routing` | **≥ 1 GB** | Tylko BRouter HTTP |
| Backend API | ≥ 1 GB | Status poll + heal |
| BRouter | ≥ 512 MB | `*.railway.internal` |

---

## 6. Deploy bez stagingu (11C)

| Ryzyko | Mitigacja (rola) |
|--------|------------------|
| Regresja live sim | Platform Operator: niski `active_ratio` przed 10k |
| OOM worker | [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) + verify script |
| RBAC / Wipe | Release Manager: P0 smoke; wipe tylko planowany |

**Obowiązkowe:** feature flags `SCALE_SIM_ASYNC_ROUTING`; P0 smoke; reset locks po SIGKILL; rollback obrazu Railway.

---

## 7. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [operations/SIMULATOR.md](../operations/SIMULATOR.md) | Runbook batch → live |
| [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + skrypt |
| [operations/OPERATIONS_INDEX.md](../operations/OPERATIONS_INDEX.md) | Macierz runbooków |
| [operations/BROUTER.md](../operations/BROUTER.md) | BRouter |
| [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) | Release gate |

---

## 8. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-04 | **Operational closure (Railway 8GB):** `active_ratio` 0.46→0.18, routing 3→2 repliki, RAM budget SSOT, serwis `telemetry` utworzony, map benchmark `detail=summary`, `set_live_active_ratio` cmd + `railway-set-live-active-ratio.ps1` |
| 2026-06-04 | **Telemetry sharding Phase 2:** `TelemetryShardRouter.client_for()` + `REDIS_TELEMETRY_SHARD_NODES`, parallel read fan-out, FastAPI asyncpg pool/batching, load-test scaffold ([TELEMETRY_LOAD_TEST.md](../operations/TELEMETRY_LOAD_TEST.md)). Prod: `TELEMETRY_SHARD_COUNT=4` on backend + simulation |
| 2026-06-03 | **Always-on protection + telemetry sharding (foundation):** globalny `core/load_guard.py` (always-on, load-driven, hysteresis, fail-open — join/session/ingest + concurrent cap), `TelemetryShardRouter` (`activities/telemetry_shard.py`, shard po `deviceId`/CRC32, hash-tag `{tel:i}`, read fan-out, `TELEMETRY_SHARD_COUNT=1` = legacy), always-on telemetry ingest backpressure (Django signal + FastAPI 429), 32 testy. Multi-instance per-shard = Faza 2 (patrz [operations/TELEMETRY_SHARDING.md](../operations/TELEMETRY_SHARDING.md)) |
| 2026-06-03 | Scaling routing: `numReplicas=2→3` (horizontal, ~3 GB łącznie). Pomiar prod: drenaż ~1,89/s (~liniowy), backpressure nadal przypięty (1/6,2 s) → decydująca dźwignia = obniżenie `active_ratio`; p.6 niezamknięte. Brak OOM |
| 2026-06-03 | Scaling routing: `celery-worker-routing` `numReplicas=1→2` (horizontal, ~1 GB/replikę) w odpowiedzi na sustained backpressure; aktualizacja p.4 i p.6 operational closure |
| 2026-06-03 | Operational closure weryfikacja prod (read-only): p.3 🟡 (infra PASS, role UI manual), p.4 🟡 (queue stable, warming n/a), p.5 ✅ (szablon + snapshot), p.6 ☐ (backpressure ciągły ≥7,5 min) |
| 2026-06-03 | Cross-link: pełna checklista GPX w P2 §2.3 (F1–F6) |
| 2026-06-03 | GPX → P2_ROADMAP; wyjaśnienie P2 vs Paczka 6 |
| 2026-06-03 | Paczka 1b enterprise: map FSM, Simulator queue KPI, operational gate checklist |
| 2026-06-03 | Paczka 1b: routing backpressure + Dashboard sim KPI |
| 2026-06-03 | Paczka 1a done; linki verify script; 1b + Paczka 2 next |
| 2026-06-03 | Utworzenie dokumentu; FSM + routing queue + API/UI |
