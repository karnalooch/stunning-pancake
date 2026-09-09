# 4VELO — Rzeczywista macierz poleceń jakości

> **Cel:** zweryfikować *rzeczywiste* (nie deklarowane) polecenia jakości dla komponentów monorepo. Bez napraw, bez zmian kodu/konfiguracji/zależności/dokumentacji.
> **Data:** 2026-09-09 · **Gałąź:** `audit/quality-command-matrix`.
>
> **Legenda wyników:** `PASS` — sukces · `FAIL` — polecenie zostało uruchomione i zakończyło się niezerowym kodem wyjścia; sam status nie rozstrzyga, czy przyczyną jest kod, konfiguracja repo, zależności czy środowisko · `BLOCKED` — brak wymaganej usługi/narzędzia (nie jest to błąd kodu) · `NOT RUN` — świadomie nieuruchomione (polityka/długość/mutacja) · `NOT DEFINED` — brak polecenia.

## Środowisko weryfikacji (fakty)

| Element | Stan |
|---|---|
| Node.js | `v24.14.1` (CI/rekomendacja: Node 20 LTS — `ci.yml NODE_VERSION='20'`) |
| pnpm | brak globalnie; `corepack pnpm` → `9.15.0` (zgodny z `packageManager`) |
| Python | `3.14.2` global; `backend/venv` → `3.14.2` z Django `6.0.4` (requirements pinują `4.2.30`); global ma Django `4.2.30` |
| Docker / Podman | brak (niedostępne w środowisku audytu) |
| ruff / mypy / pytest | nie zainstalowane (ani w `backend/venv`, ani globalnie) |
| PostGIS / Redis | brak uruchomionych usług |
| `mobile/node_modules` | nieobecny (zależności mobile nie zainstalowane) |
| `admin/node_modules` | częściowy (własny `eslint`; `tsc`/`vite`/`vitest` hoisted do root `node_modules`) |
| root `node_modules/.bin` | obecne: `tsx`, `turbo`, `tsc`, `vite`, `vitest`, `eslint`, `orval` |

**Uwaga o czasie:** każde wywołanie `corepack pnpm --filter …` ponosi ok. 40–60 s narzutu startu pnpm (cold start). Czasy poniżej to czas pełnego wywołania, nie samego narzędzia.

---

| Komponent | Rodzaj kontroli | Polecenie deklarowane | Polecenie rzeczywiste | Źródło polecenia | Wynik | Czas wykonania | Wymagane usługi | Blokery | Uwagi |
|---|---|---|---|---|---|---|---|---|---|
| root | install | `corepack pnpm install --frozen-lockfile` | *(nieuruchomione)* | `package.json` (`packageManager`) + `docs/PROJECT_TAKEOVER.md` | NOT RUN | — | — | reguła 5: nie zmieniać zależności | root `node_modules` już obecny |
| root | build | `turbo run build` | `corepack pnpm build` | `package.json` | BLOCKED | 14.7 s | — | turbo nie znajduje binarki pnpm | błąd: `Unable to find package manager binary: cannot find binary path`; pnpm dostępny tylko przez shim corepack, nie w `PATH` |
| root | lint | `turbo run lint` | *(nieuruchomione)* | `package.json` | BLOCKED | — | — | ten sam bloker co build (turbo → pnpm) | BLOCKED wywnioskowany — nie uruchomiono osobno; wspólny błąd mechanizmu turbo/pnpm potwierdzony w root build |
| root | test | `turbo run test` | *(nieuruchomione)* | `package.json` | BLOCKED | — | — | ten sam bloker co build (turbo → pnpm) | BLOCKED wywnioskowany — nie uruchomiono osobno; wspólny błąd mechanizmu turbo/pnpm potwierdzony w root build |
| root | tokens:check | `pnpm --filter @4velo/tokens check` | `corepack pnpm --filter @4velo/tokens check` | `package.json` | PASS | 60.3 s | — | — | `✅ tokens:check passed — generated files are up-to-date.` |
| root | api:codegen:check | `pnpm --filter @4velo/api-client codegen:check` | `corepack pnpm --filter @4velo/api-client codegen:check` | `package.json` | PASS | 47.9 s | — | — | `codegen:check — all critical paths present in openapi.json` |
| root | api:export | `python scripts/export_openapi.py` | *(nieuruchomione)* | `package.json` | NOT RUN | — | backend (Django) | wymaga środowiska Django/PostGIS | mutuje `packages/api-client/openapi.json` (reguła 10) |
| root | gate:simulator | `python scripts/simulator_operational_gate.py` | *(nieuruchomione)* | `package.json` | NOT RUN | — | backend + Redis | reguła 6/7 (operacje na usługach) | — |
| root | gate:p0-smoke / gate:p1-closure | `pwsh scripts/run-p0-smoke.ps1` / `run-p1-closure.ps1` | *(nieuruchomione)* | `package.json` | NOT RUN | — | backend + Redis | reguła 6/7 | — |
| root | audit:* (routes/screens/mobile/api/rbac/…) | `tsx scripts/audit-*.ts` | *(nieuruchomione)* | `package.json` | NOT RUN | — | część wymaga backendu | długa seria; część wymaga usług | — |
| backend | install | `pip install -r requirements.txt` | *(nieuruchomione)* | `backend/Dockerfile`, `.github/workflows/ci.yml` | NOT RUN | — | — | reguła 5 | `backend/venv` ma Django `6.0.4` (≠ pin `4.2.30`); Python `3.14` (CI: `3.12`) |
| backend | lint | `ruff check .` | *(nieuruchomione)* | `backend/pyproject.toml`, `ci.yml` | BLOCKED | — | — | `ruff` nie zainstalowany | `ModuleNotFoundError: No module named 'ruff'` |
| backend | format-check | `ruff format --check .` | *(nieuruchomione)* | `ci.yml` | BLOCKED | — | — | `ruff` nie zainstalowany | — |
| backend | typecheck | `mypy --config-file mypy-ci.ini core/load_guard.py …` | *(nieuruchomione)* | `backend/pyproject.toml`, `ci.yml` | BLOCKED | — | — | `mypy` nie zainstalowany | `ModuleNotFoundError: No module named 'mypy'` |
| backend | check | `python manage.py check` | `python manage.py check` (bez env) | `ci.yml` | BLOCKED | 14.7 s | PostgreSQL/PostGIS, `SECRET_KEY`, `DATABASE_URL` | brak env/usług | błąd: `RuntimeError: SECRET_KEY must be set in production…`; reguła 4 — nie podstawiać SQLite |
| backend | test | `python run_pytest.py …` / `python manage.py test` | *(nieuruchomione)* | `backend/pyproject.toml`, `ci.yml` | BLOCKED | — | PostgreSQL/PostGIS + Redis | `pytest` nie zainstalowany + brak usług | reguła 4 |
| backend | migrate | `python manage.py migrate` | *(nieuruchomione)* | `backend/docker-entrypoint.sh`, `ci.yml` | NOT RUN | — | PostgreSQL/PostGIS | reguła 7: brak migracji na zewnętrznej bazie | — |
| backend | build | `docker build -f backend/Dockerfile -t 4velo-backend:local backend` | nieuruchomione | `backend/Dockerfile` | BLOCKED | — | — | brak Docker/Podman | budowa obrazu nie została uruchomiona |
| backend | start | `python manage.py runserver` / `gunicorn core.wsgi` | *(nieuruchomione)* | `backend/docker-entrypoint.sh` | NOT RUN | — | PostgreSQL/PostGIS + Redis | serwer długotrwały | reguła 9 |
| telemetry | install | `pip install -r requirements.txt -r requirements-dev.txt` | *(nieuruchomione)* | `telemetry/Dockerfile`, `ci.yml` | NOT RUN | — | — | reguła 5 | — |
| telemetry | lint | `ruff check telemetry` | *(nieuruchomione)* | `ci.yml` | BLOCKED | — | — | `ruff` nie zainstalowany | — |
| telemetry | format-check | `ruff format --check telemetry` | *(nieuruchomione)* | `ci.yml` | BLOCKED | — | — | `ruff` nie zainstalowany | — |
| telemetry | typecheck | — | — | — | NOT DEFINED | — | — | brak konfiguracji mypy dla telemetrii | — |
| telemetry | test | `pytest` (pytest-asyncio) | `python -c "import config"` (próba importu) | `ci.yml`, `telemetry/pytest.ini` | BLOCKED | 2 s | PostgreSQL (`DATABASE_URL`), Redis | `pytest` nie zainstalowany + import wymaga env | błąd: `KeyError: 'DATABASE_URL'` w `config.py:7` |
| telemetry | build | `docker build -f telemetry/Dockerfile -t 4velo-telemetry:local telemetry` | nieuruchomione | `telemetry/Dockerfile` | BLOCKED | — | — | brak Docker/Podman | — |
| telemetry | start | `uvicorn main:app --host 0.0.0.0 --port 8001` | *(nieuruchomione)* | `telemetry/Dockerfile`, `main.py` | NOT RUN | — | PostgreSQL + Redis | serwer długotrwały | reguła 9 |
| admin | install | `pnpm install` (workspace) | *(nieuruchomione)* | `admin/package.json` | NOT RUN | — | — | reguła 5 | zależności częściowo hoisted do root |
| admin | lint | `eslint .` | `corepack pnpm --filter admin lint` | `admin/package.json` | PASS | 108.4 s | — | — | `✖ 109 problems (0 errors, 109 warnings)` (baseline przejęcia: 108) |
| admin | typecheck | `node ../node_modules/typescript/bin/tsc --noEmit` | `corepack pnpm --filter admin typecheck` | `admin/package.json` | PASS | 53.3 s | — | — | `tsc --noEmit` bez błędów |
| admin | test | `vitest run` | `corepack pnpm --filter admin test:run` | `admin/package.json` | FAIL | 266.4 s | — | — | 39 plików testowych i 139 testów zaraportowano jako zaliczone, ale cały proces zakończył się kodem 1: `[vitest-pool] Failed to start forks worker … SystemIntelligence.test.tsx` → `Timeout waiting for worker to respond` |
| admin | build | `vite build` | `corepack pnpm --filter admin build` | `admin/package.json` | FAIL | 105.7 s | — | — | `Could not resolve "./icons/IconBrandAdobePremiere.mjs" from "../node_modules/@tabler/icons-react/dist/esm/tabler-icons-react.mjs"` (2687 modułów) |
| admin | test:e2e | `playwright test` | *(nieuruchomione)* | `admin/package.json` | NOT RUN | — | backend + przeglądarka Playwright | `playwright` nie zainstalowany (`admin/node_modules/.bin` brak) + wymaga backendu | reguła 9 |
| admin | smoke:p0 | `node scripts/p0-role-smoke.mjs` | *(nieuruchomione)* | `admin/package.json` | NOT RUN | — | backend | reguła 6/7 | — |
| admin | build:exe | `electron-builder --win --x64 --dir` | *(nieuruchomione)* | `admin/package.json` | NOT RUN | — | — | buduje artefakt `.exe`; długie | reguła 9 |
| admin | format-check | — | — | — | NOT DEFINED | — | — | brak formatera (ESLint tylko lint) | — |
| mobile | install | `corepack pnpm install --frozen-lockfile` | *(nieuruchomione)* | `mobile/package.json` | NOT RUN | — | — | reguła 5 | wykonywane z root workspace na podstawie root `pnpm-lock.yaml` i `pnpm-workspace.yaml`; `mobile/node_modules` nieobecny |
| mobile | lint | `expo lint` | *(nieuruchomione)* | `mobile/package.json` | BLOCKED | — | — | `mobile/node_modules` nie zainstalowane (reguła 5) | — |
| mobile | typecheck | `tsc --noEmit` | *(nieuruchomione)* | `mobile/package.json` | BLOCKED | — | — | `mobile/node_modules` nie zainstalowane | — |
| mobile | test | `jest --config jest.config.js` | *(nieuruchomione)* | `mobile/package.json` | BLOCKED | — | — | `mobile/node_modules` nie zainstalowane | — |
| mobile | test:coverage | `jest --config jest.config.js --coverage` | *(nieuruchomione)* | `mobile/package.json` | BLOCKED | — | — | `mobile/node_modules` nie zainstalowane | — |
| mobile | test:e2e | `scripts/run-mobile-e2e.ps1` (Maestro) | *(nieuruchomione)* | `mobile/package.json` | NOT RUN | — | emulator Android + Maestro + backend | reguła 3 (brak emulatora) + reguła 6 | — |
| mobile | build (EAS) | `npx eas build --platform <android-or-ios> --profile …` | *(nieuruchomione)* | `mobile/package.json`, `eas.json` | NOT RUN | — | konto Expo EAS | reguła 6: nie uruchamiać buildów EAS | — |
| mobile | start | `expo start` | *(nieuruchomione)* | `mobile/package.json` | NOT RUN | — | — | serwer długotrwały | reguła 9 |
| mobile | format-check | — | — | — | NOT DEFINED | — | — | — | — |
| packages/api-client | codegen | `orval --config orval.config.ts` | *(nieuruchomione)* | `packages/api-client/package.json` | NOT RUN | — | — | mutuje `src/generated/` (reguła 10) | — |
| packages/api-client | codegen:check | `node scripts/check-openapi-paths.mjs` | `corepack pnpm --filter @4velo/api-client codegen:check` | `packages/api-client/package.json` | PASS | 47.9 s | — | — | `all critical paths present in openapi.json` |
| packages/api-client | lint / test / build / typecheck | — | — | — | NOT DEFINED | — | — | brak skryptów jakości | — |
| packages/tokens | build | `tsx build.ts` | *(nieuruchomione)* | `packages/tokens/package.json` | NOT RUN | — | — | mutuje `generated/` (reguła 10) | `check` potwierdza aktualność |
| packages/tokens | check | `tsx build.ts --check` | `corepack pnpm --filter @4velo/tokens check` | `packages/tokens/package.json` | PASS | 60.3 s | — | — | `generated files are up-to-date` |
| packages/tokens | lint / test / typecheck | — | — | — | NOT DEFINED | — | — | brak skryptów jakości | — |
| packages/eslint-config | wszystkie | — | — | `packages/eslint-config/package.json` | NOT DEFINED | — | — | pakiet wyłącznie konfiguracyjny (brak `scripts`) | — |
| packages/tsconfig | wszystkie | — | — | `packages/tsconfig/package.json` | NOT DEFINED | — | — | pakiet wyłącznie konfiguracyjny (brak `scripts`) | — |

---

## Podsumowanie wyników

| Wynik | Liczba wierszy |
|---|---|
| PASS | 6 (root tokens:check, root api:codegen:check, admin lint, admin typecheck, api-client codegen:check, tokens check) |
| FAIL | 2 (admin test, admin build) |
| BLOCKED | 17 |
| NOT RUN | 20 |
| NOT DEFINED | 7 |

Razem: 52 wiersze.

**Obserwacje (bez napraw):**

1. admin build zakończył się FAIL w badanym środowisku z częściowo zainstalowanymi zależnościami i Node 24; wynik wymaga ponowienia po czystym frozen install na Node 20 albo porównania z CI.
2. wszystkie zaraportowane testy zakończyły się sukcesem, lecz cały proces zwrócił exit 1 wskutek błędu uruchomienia workera Vitest; nie jest to dowód niezaliczenia testu funkcjonalnego.
3. **root `turbo run …` nie działa w tym środowisku** — turbo nie znajduje binarki pnpm (pnpm dostępny tylko przez `corepack`); `root lint` i `root test` nie były uruchamiane osobno, ich `BLOCKED` wywnioskowano z tego samego błędu co `root build`.
4. **Backend i telemetry są `BLOCKED`** — brak `ruff`/`mypy`/`pytest` oraz brak PostGIS/Redis; nie zastępowano bazy SQLite (reguła 4).
5. **Mobile w całości `BLOCKED`** — `mobile/node_modules` nieobecny; nie instalowano zależności (reguła 5).
6. **Niezgodności wersji środowiska:** Node 24.14.1 (CI: 20), Python 3.14 (CI: 3.12), `backend/venv` Django 6.0.4 (pin: 4.2.30). Mogą wpływać na powyższe wyniki.

## Załącznik — kontrola linków dokumentacji

Wynik `python scripts/check_docs_links.py` (tylko względne linki Markdown; pomija `docs/archive/`):

```
OK — checked 308 markdown files
```
