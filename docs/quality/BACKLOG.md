# Quality backlog — cały projekt

Etykiety GitHub sugerowane: `quality-p0`, `quality-p1`, `quality-p2`.

---

## P0 — przed kolejnym dużym release / event

| ID | Obszar | Problem | Działanie |
|----|--------|---------|-----------|
| Q-P0-1 | **telemetry** | `main.py` ~1000 linii | **Done** — `routes.py`, `ingest_service.py`, `db.py`, `lifecycle.py`, … |
| Q-P0-2 | **mobile** | `GpsSyncManager.ts` — storage+sync+UI | **Done** — `gpsSyncUpload.ts` + recovery test |
| Q-P0-3 | **backend** | `simulator_tasks.py` — monolit | **Done (minimal)** — `simulator_route_waypoints.py`, `simulator_live_tick.py`; reszta tick/batch → P1 |
| Q-P0-4 | **CI** | mypy nie blokuje | **Done** — `mypy-ci.ini` na 5 modułach bez `\|\| true` |
| Q-P0-5 | **guard** | Django vs telemetry ingest | **Done** — `tests/fixtures/ingest_guard_parity.json` + `telemetry/test_guard_parity.py` |
| Q-P0-6 | **mobile** | Brak `npm run lint` | **Done** — `expo lint` + job CI |
| Q-P0-7 | **backend** | Ruff `ignore` dług | **Done (step)** — usunięto `C408` z ignore + fix 3× `dict()` w admin_views |

---

## P1 — jakość utrzymania

| ID | Obszar | Problem | Działanie |
|----|--------|---------|-----------|
| Q-P1-1 | **telemetry** | FastAPI `on_event` deprecated | **Done** — `lifespan` w `lifecycle.py`, `main.py` |
| Q-P1-2 | **admin** | Duże moduły Live Map | **Done** — granice SSOT w `admin/README.md` (moduły `liveMap*`) |
| Q-P1-3 | **backend** | OpenAPI drift | **Done** — `scripts/check_openapi_drift.py`, [OPENAPI_DRIFT.md](./OPENAPI_DRIFT.md), CI |
| Q-P1-4 | **mobile** | Coverage Jest <60% | **Done** — `rideSessionService.test.ts` (start/stop + mocked API/GPS) |
| Q-P1-5 | **scripts** | Ruff tylko na 3 plikach CI | **Done** — `ruff check scripts`, per-file-ignore dla generatorów |
| Q-P1-5b | **scripts** | Brak testów `check_docs_links` | **Done** — `scripts/test_check_docs_links.py` + CI pytest |
| Q-P1-6 | **infra** | OSRM/BRouter skrypty bez review | **Done** — [INFRA_PR_CHECKLIST.md](./INFRA_PR_CHECKLIST.md), PR template |
| Q-P1-7 | **security** | Dependabot high | **Done (partial)** — mobile `npm audit`: 0 high; moderate `ajv` w łańcuchu ESLint ([GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)) — dev-only, `npm audit fix` po aktualizacji eslint-config-expo |
| Q-P1-8 | **backend** | `simulator_tasks.py` reszta | **Done** — `simulator_batch_tasks.py`, `simulator_live_orchestrator.py`, facade w `simulator_tasks.py` |

---

## P2 — dług techniczny / nice-to-have

| ID | Obszar | Problem | Działanie |
|----|--------|---------|-----------|
| Q-P2-1 | **telemetry** | JWT na ingest | Gateway lub middleware |
| Q-P2-2 | **ADR** | Server GPX export | P2_ROADMAP F1 |
| Q-P2-3 | **backend** | Coverage 80% | pytest-cov w CI |
| Q-P2-4 | **admin** | Vitest unit (Konstytucja) | Osobny job obok Playwright |
| Q-P2-5 | **Kafka** | ADR 011 defer | Tylko po SLO Redis Stream |

---

## Obszary poza kodem (review checklist)

| Obszar | Ścieżka | Co sprawdzać |
|--------|---------|--------------|
| Docker / Railway | `docker-compose*`, `*/railway.json`, `infrastructure/` | Sekrety, healthcheck, wolumeny — [INFRA_PR_CHECKLIST.md](./INFRA_PR_CHECKLIST.md) |
| Env | `.env.example` vs Railway Variables | Drift — `admin npm run audit:env` |
| Docs | `docs/`, ADR | SSOT, `Last reviewed` |
| Compliance | `docs/compliance/` | Przy release publicznym |
