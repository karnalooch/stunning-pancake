# Quality backlog — cały projekt

Etykiety GitHub sugerowane: `quality-p0`, `quality-p1`, `quality-p2`.

---

## P0 — przed kolejnym dużym release / event

| ID | Obszar | Problem | Działanie |
|----|--------|---------|-----------|
| Q-P0-1 | **telemetry** | `main.py` ~1000 linii | **Done** — `routes.py`, `ingest_service.py`, `db.py`, `lifecycle.py`, … |
| Q-P0-2 | **mobile** | `GpsSyncManager.ts` — storage+sync+UI | Rozdzielić moduły; test recovery po `stopTracking` |
| Q-P0-3 | **backend** | `simulator_tasks.py` — monolit | Podmoduły tick / publish / routing |
| Q-P0-4 | **CI** | mypy nie blokuje | `mypy core activities telemetry` bez `\|\| true` |
| Q-P0-5 | **guard** | Django vs telemetry ingest | Wspólny plik wektorów testów JSON |
| Q-P0-6 | **mobile** | Brak `npm run lint` | `expo lint` + job CI |
| Q-P0-7 | **backend** | Ruff `ignore` dług | Co tydzień −1 reguła z ignore |

---

## P1 — jakość utrzymania

| ID | Obszar | Problem | Działanie |
|----|--------|---------|-----------|
| Q-P1-1 | **telemetry** | FastAPI `on_event` deprecated | Migracja na `lifespan` |
| Q-P1-2 | **admin** | Duże moduły Live Map | Już podzielone — utrzymać granice |
| Q-P1-3 | **backend** | OpenAPI drift | Automatyczny diff lub checklist w PR |
| Q-P1-4 | **mobile** | Coverage Jest <60% | Testy ekranów krytycznych (start/stop ride) |
| Q-P1-5 | **scripts** | Ruff tylko na 3 plikach CI; reszta `scripts/` = 80+ violations | `ruff check scripts --fix` + job pełny |
| Q-P1-5b | **scripts** | Brak testów `check_docs_links` | pytest na parser linków |
| Q-P1-6 | **infra** | OSRM/BRouter skrypty bez review | Checklist w PR przy `infrastructure/` |
| Q-P1-7 | **security** | Dependabot high | [GitHub Security](https://github.com/karnalooch/stunning-pancake/security) |

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
| Docker / Railway | `docker-compose*`, `*/railway.json`, `infrastructure/` | Sekrety, healthcheck, wolumeny |
| Env | `.env.example` vs Railway Variables | Drift — `admin npm run audit:env` |
| Docs | `docs/`, ADR | SSOT, `Last reviewed` |
| Compliance | `docs/compliance/` | Przy release publicznym |
