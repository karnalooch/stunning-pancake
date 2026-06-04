# Quality baseline — 2026-06-04

Wynik **Fazy 0** dla całego monorepo. Odśwież po większych zmianach: `.\scripts\run-quality-baseline.ps1`.

| Moduł | Check | Wynik | Uwagi |
|-------|-------|-------|-------|
| **backend** | `ruff check .` | ✅ PASS (po fix E741) | Duży `ignore` w `pyproject.toml` = dług stylu |
| **backend** | `ruff format --check` | Uruchom w skrypcie | |
| **backend** | `mypy` (CI) | ✅ PASS (5 modułów) | `mypy-ci.ini` — load_guard, telemetry_shard, … |
| **backend** | `manage.py test` | CI | Długi; lokalnie opcjonalnie |
| **telemetry** | `ruff check` | ✅ PASS | Po format + fix importów |
| **telemetry** | `pytest` | ✅ 6 passed | Warnings: FastAPI `on_event` deprecated |
| **admin** | `npm run lint` | CI | + `audit:*` (routes, RBAC, env) |
| **admin** | `tsc --noEmit` | CI | |
| **admin** | Playwright E2E | CI `e2e` | |
| **mobile** | `npm test --ci` | ✅ 10 passed (GPS suites) | Pełny Jest — rozszerzyć CI |
| **mobile** | `npm run lint` (expo) | ✅ CI job | `expo lint` |
| **scripts/** | `ruff check` (3 utrzymywane pliki) | ✅ PASS | Pełny `scripts/` — BACKLOG Q-P1-5 |
| **docs** | `check_docs_links.py` | CI `docs.yml` | |
| **shared/tokens** | `npm run tokens:check` | CI `repo-assets` | Root `package.json` |

## Rozjazdy Konstytucja ↔ narzędzia

| Konstytucja | Stan repo | Akcja (BACKLOG) |
|-------------|-----------|-----------------|
| Linia 120 znaków | Ruff 100 w `pyproject.toml` | Ujednolicić doc lub config |
| mypy strict | CI opcjonalne (`|| true`) | Faza 1: fail na `core`, `telemetry` |
| Coverage >80% backend | Brak gate w CI | Faza 3: pytest-cov próg etapami |
| Mobile ESLint | Brak skryptu | `expo lint` + job CI |

## Następny krok

1. Utrzymać zielony CI po [Fazie 1](../quality/README.md#fazy-0--5-co-robić-w-praktyce).
2. Zamykać pozycje [BACKLOG.md](./BACKLOG.md) P0 w małych PR-ach.
