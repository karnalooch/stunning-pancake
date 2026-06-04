# Quality baseline — 2026-06-04

Wynik **Fazy 0 + P1** dla całego monorepo. Odśwież po większych zmianach: `.\scripts\run-quality-baseline.ps1`.

| Moduł | Check | Wynik | Uwagi |
|-------|-------|-------|-------|
| **backend** | `ruff check .` | ✅ PASS (po fix E741) | Duży `ignore` w `pyproject.toml` = dług stylu |
| **backend** | `ruff format --check` | Uruchom w skrypcie | |
| **backend** | `mypy` (CI) | ✅ PASS (5 modułów) | `mypy-ci.ini` |
| **backend** | `manage.py test` | CI | Długi; lokalnie opcjonalnie |
| **backend** | simulator_light pytest | ✅ PASS | `simulator_batch_tasks`, `simulator_live_orchestrator` |
| **telemetry** | `ruff check` | ✅ PASS | |
| **telemetry** | `pytest` | ✅ 15 passed | Brak ostrzeżeń `on_event` (lifespan) |
| **admin** | `npm run lint` | CI | + `audit:*` |
| **admin** | `tsc --noEmit` | CI | |
| **admin** | Playwright E2E | CI `e2e` | |
| **mobile** | `npm test --ci` | ✅ 74 passed | AvatarTrainer: bez fake timers, spy na `triggerEngine.push` |
| **mobile** | `npm run lint` (expo) | ✅ CI job | |
| **scripts/** | `ruff check scripts` | ✅ PASS | Pełny katalog; ignore na `generate_assets` / `gemini_client` |
| **scripts** | `check_openapi_drift.py` | ✅ PASS | CI `scripts-python` |
| **scripts** | `test_check_docs_links.py` | ✅ 3 passed | |
| **docs** | `check_docs_links.py` | CI `docs.yml` | |
| **shared/tokens** | `npm run tokens:check` | CI `repo-assets` | |

## Rozjazdy Konstytucja ↔ narzędzia

| Konstytucja | Stan repo | Akcja (BACKLOG P2) |
|-------------|-----------|---------------------|
| Linia 120 znaków | Ruff 100 w `pyproject.toml` | Ujednolicić doc lub config |
| mypy strict | CI na 5 modułach | Rozszerzać `mypy-ci.ini` etapami |
| Coverage >80% backend | Gate **40%** phased (pytest-cov) | Podnieść etapami do 80% |
| Vitest admin | CI `admin` job | `npm run test -- --run` |
| GPX F1 | `GET …/sessions/{id}/gpx/` | F2+ w P2_ROADMAP |
| Telemetry JWT ingest | Opcjonalne (`TELEMETRY_INGEST_JWT_REQUIRED`) | ADR 011 |
| Mobile ESLint ajv moderate | Dev dependency chain | P1-7 partial — po bump eslint-config-expo |

## Następny krok

1. Zamykać pozycje [BACKLOG.md](./BACKLOG.md) **P2** w małych PR-ach.
2. Utrzymać zielony CI — [README](./README.md#fazy-0--5-co-robić-w-praktyce).
