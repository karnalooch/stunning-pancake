# Plan T22 — CI path routing + aggregate check

## 1. Stan repo i SHA (dowody z read-only 2026-09-10)

- **Aktualny branch lokalny:** `docs/takeover-cleanup-plan` (HEAD = `6c18872330102086066d1cfdb975da74ac6d16b4`).
- **Aktualny `origin/main` (per `git ls-remote`):** `b03fb9e27d1c10dbd26e14ef13a63a9757054ed0` (zgodny z potwierdzonym faktem).
- **Lokalnie cached `origin/main`:** `df2f5fe59d3858ab415f3d48c4900c30ee464e67` (stale, środowisko blokuje `git fetch`).
- **PR #47 (T01):** Draft, head `c01c9b40a6a5ef57a2ca0734efd2c45e4e8ad406`, BLOCKED — OWNER ACTION REQUIRED (nienaruszalny).
- **PR #59 (T21):** MERGED (squash → `b03fb9e…`); gałąź `ci/mobile-path-filter-integrity` już zniknęła z remote refs (squash-merge).
- **PR #60 (T00):** MERGED (squash → `b16792cc1cf368c690747618838a1ce175d2314c`); refs/pull/60/merge nie istnieje (scalony).
- **Gałąź `origin/ci/required-aggregate-check`:** nie istnieje (potwierdzone `git ls-remote`).
- **Lokalna gałąź `ci/required-aggregate-check`:** nie istnieje.
- **Working tree (śledzone):** czysty. **Nieśledzone:** `.kilo/plans/1789063741873-takeover-cleanup-plan.md`, `.kilo/plans/1789069397861-t00-takeover-cleanup-plan.md`. Żaden plik `.kilo/plans/*.md` nie może być modyfikowany przez T22.

Ograniczenie środowiska: `git fetch origin --prune` jest zablokowane przez reguły uprawnień środowiska; wszystkie dane o `origin/main` (b03fb9e), `refs/pull/*/head` i gałęziach zdalnych uzyskano przez `git ls-remote` oraz webfetch (Ground truth).

## 2. Instrukcje AGENTS

Repo **nie zawiera pliku `AGENTS.md`** (potwierdzone: webfetch na `AGENTS.md` → 404; wyszukiwarka kodu na `AGENTS.md` → 0 plików). Najbliższym SSOT instrukcji jest `README.md` na `main`:

- **Środowisko:** Node 20, pnpm 9.15, Python 3.11 (obrazy) / Python 3.12 (CI). Pełne testy integracyjne wymagają PostgreSQL/PostGIS + Redis; SQLite ich nie zastępuje.
- **Komponenty:** `backend/`, `telemetry/`, `admin/`, `mobile/`, `packages/`, `infrastructure/`, `celery-worker*/`.
- **Sekretna kontrola:** przed scaleniem konfiguracji kluczy — procedura z `docs/operations/SIGNING_KEY_ROTATION.md`.
- **Kontrole lokalne:** `python scripts/check_docs_links.py`, `python scripts/check_docs_i18n.py`, `python scripts/check_config_secrets.py`, `python scripts/check_openapi_drift.py`.
- **Sekcje T22-implementujące:** `corepack pnpm --filter admin lint|typecheck|test:run|build` (gdy zmieniono admin), `corepack pnpm --filter mobile lint|typecheck|test -- --runInBand --ci` (gdy zmieniono mobile), `cd backend && ruff check . && ruff format --check . && mypy --config-file mypy-ci.ini <scoped>` (gdy zmieniono backend), `cd telemetry && ruff check telemetry && ruff format --check telemetry`.

Wnioski dla T22:
- `AGENTS.md` nie istnieje — T22 go nie tworzy, ale dokumentacja komend (sekcja Verification) musi być spójna z README.md.
- `corepack` i `pnpm@9.15.0` są kanoniczne (z `package.json`).
- Testy nowego skryptu `scripts/check_ci_aggregate.py` i `scripts/test_ci_aggregate.py` podlegają Ruff z root `pyproject.toml` (`scripts/` lint scope: `select = ["E","W","F","I","B","UP"]`, `ignore = ["E501","B008"]`).

## 3. Aktualna architektura CI (`.github/workflows/ci.yml` @ `b03fb9e`)

### Nazwa workflow, zdarzenia, uprawnienia
- Nazwa: `4VELO CI/CD Pipeline`.
- Zdarzenia: `push: [master, main, develop]`, `pull_request: [master, main, develop]`, `schedule: cron '0 2 * * *'`. Brak `workflow_dispatch`.
- `permissions: contents: read`. Wyłącznie joby `trivy` overridują na `security-events: write` i `actions: read`.
- Zmienne środowiskowe: `PYTHON_VERSION=3.12`, `NODE_VERSION=20`.

### Job `changes` (detect path filter)
- Krok `dorny/paths-filter@v3` z filtrami:
  - `backend: ['backend/**']`
  - `telemetry: ['telemetry/**']`
  - `mobile: ['mobile/**']`
  - `admin: ['admin/**']`
  - `packages: ['packages/**', '.github/actions/pnpm-setup/**', '.npmrc', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']`
  - `scripts: ['scripts/**', 'pyproject.toml']`
  - `docs: ['docs/**']`
  - `workflow: ['.github/workflows/**']`
- Drugi krok ustawia `full`:
  - `full=true` dla `schedule` lub `push` (czyli po merge do main/master/develop),
  - `full=true` jeśli `workflow=true` (zmieniono `.github/workflows/**`),
  - `full=false` w innych przypadkach (PR bez zmian w workflow).

### Joby i ich wyzwalacze (potwierdzone z `ci.yml`)

| Job | `needs` | `if` | Blokujący? | Uwagi |
|---|---|---|---|---|
| `changes` | — | (zawsze) | tak | wyjście `backend/telemetry/mobile/admin/packages/scripts/docs/workflow/full` |
| `backend` | `changes` | `full==true \|\| backend==true` | tak (z wyjątkiem `Full legacy suite` z `continue-on-error: true`) | Lint, mypy, migracje, pytest |
| `telemetry` | `changes` | `full==true \|\| telemetry==true` | tak (kroki nie-blokujące: `continue-on-error` brak, więc wszystkie kroki blokują; `pip-audit`/`pnpm audit` są w `security`, nie tu) | Ruff + pytest |
| `mobile` | `changes` | `full==true \|\| mobile==true \|\| packages==true` | tak | Lint, typecheck, design token guard, testy |
| `scripts-python` | `changes` | `full==true \|\| scripts==true \|\| backend==true` | tak | Ruff + openapi drift + test_docs_links + test_load_report + test_ci_mobile_path_filter |
| `repo-assets` | `changes` | `full==true \|\| packages==true` | tak | design tokens + api client codegen check |
| `docs-links` | `changes` | `full==true \|\| docs==true` | tak | check_docs_links.py |
| `admin` | `changes` | `full==true \|\| admin==true \|\| packages==true` | tak | ESLint, Vitest, typecheck, build |
| `audit` | `changes`, `admin` | `always() && admin.result=='success' && (full==true \|\| admin==true \|\| scripts==true)` | tak | route parity, screens, mobile, api gaps, RBAC, redirects, env, imports |
| `security` | `changes`, `backend`, `admin` | `always() && (full\|backend\|admin\|mobile) && (backend.result in [success,skipped]) && (admin.result in [success,skipped])` | **NIE** (cały job ma kroki `continue-on-error: true`; nazwa joba: „Security inventory (non-blocking)") | pip-audit + pnpm audit + license compliance |
| `trivy` | `changes` | `full==true` (tylko push/schedule/workflow change na PR) | tak (steps mają `exit-code: '0'` → raportuje, ale nie blokuje) | filesystem scan + SARIF upload |
| `e2e` | `changes`, `admin` | `always() && admin.result=='success' && (full==true \|\| admin==true)` | tak (timeout 45 min) | Playwright |

### Aggregate / required gate — POTWIERDZONY BRAK

Przeszukano `ci.yml` pod kątem:
- jobów posiadających `needs` obejmujące wszystkie inne joby (`changes`, `backend`, `telemetry`, `mobile`, `admin`, `scripts-python`, `repo-assets`, `docs-links`, `audit`, `e2e`) — **brak**;
- nazwy zawierającej „aggregate", „gate", „required" — **brak**;
- kroku w jobie, który sprawdza `${{ toJson(needs) }}` albo `${{ github.event_name }}` pod kątem „wszystkie wymagane" — **brak**;
- `outputs` w jobie `changes` o nazwie „required" — **brak** (jest tylko `full`).

**Wniosek:** T22 jest w pełni uzasadniony; nie ma konkurencyjnej implementacji.

### Zachowanie `full` względem trybu uruchomienia

| Tryb | `full` | Skutek |
|---|---|---|
| `push` (post-merge) na master/main/develop | `true` | wszystkie joby z `if: full==true \|\| <X>==true` odpalone |
| `schedule` (cron 02:00) | `true` | jak wyżej |
| `pull_request` ze zmianą `.github/workflows/**` | `true` | jak wyżej |
| `pull_request` bez zmiany workflow | `false` | tylko joby dla zmienionych ścieżek |
| `workflow_dispatch` | nieobsługiwane w `if` → `full=false` | edge case: brak |

Uwaga: brak gałęzi `develop` w `git ls-remote`; pozostawiona w `on:` zgodnie z istniejącym wzorcem (nie modyfikujemy w T22).

## 4. Macierz routingu (potwierdzona dowodami)

Na podstawie istniejącego `ci.yml` @ `b03fb9e` oraz testu `scripts/test_ci_mobile_path_filter.py` (T21):

| Reprezentatywna zmiana | Filtry, które matchują | Joby, które się uruchomią | Joby SKIPPED | Uzasadnienie |
|---|---|---|---|---|
| `backend/**` (np. `backend/activities/views.py`) | `backend` | `backend`; `scripts-python` (bo `scripts == true \|\| backend == true`); ewentualnie `security` (bo `full==false`, ale warunek `backend==true` → `security` się uruchamia) | `telemetry`, `mobile`, `admin`, `repo-assets`, `docs-links`, `audit`, `e2e`, `trivy` | backend jest leaf; nie ciągnie mobile/admin; `audit`/`e2e` wymagają `admin.result=='success'`, a admin skipped → audit skipped |
| `telemetry/**` | `telemetry` | `telemetry` | reszta poza `telemetry` | telemetry isolated |
| `mobile/**` | `mobile` | `mobile` | reszta (poza `packages`-zależnymi) | mobile isolated; `packages` nie matchuje ścieżki mobile bezpośrednio, ale mobile ma `packages==true` → mobile uruchomiony; admin/mobile odwrotnie nie |
| `admin/**` | `admin` | `admin`, `audit`, `e2e` | reszta | admin ciągnie audit (bo `admin==true`) i e2e (bo admin.result success) |
| `packages/**` (np. `packages/tokens/colors.json`) | `packages` | `mobile`, `admin`, `repo-assets` | `backend`, `telemetry`, `docs-links`, `audit`, `e2e`, `trivy`, `security` | packages triggeruje mobile+admin (ich if ma `packages==true`); `repo-assets` ma `packages==true`; reszta nie ma warunku na packages |
| `scripts/**` | `scripts` | `scripts-python`, `audit` | reszta | scripts-python ma `scripts==true`; audit ma `scripts==true` |
| `pyproject.toml` (root) | `scripts` (jest w filtrze scripts) | `scripts-python`, `audit` | reszta | signals `scripts` filter |
| `docs/**` | `docs` | `docs-links` | reszta (poza full) | jedyny job powiązany z docs to docs-links |
| `.github/workflows/**` | `workflow` | `full=true` → **wszystkie** joby | brak (poza `security`, który i tak ma `continue-on-error`) | workflow change → full check; aggregate check działa jak w `push` |
| `.github/actions/pnpm-setup/**` | `packages` | `mobile`, `admin`, `repo-assets` | reszta | pnpm-setup jest w `packages` filter |
| `package.json` (root) | `packages` | `mobile`, `admin`, `repo-assets` | reszta | root package.json jest w `packages` filter |
| `.npmrc` | `packages` | `mobile`, `admin`, `repo-assets` | reszta | j.w. |
| `pnpm-lock.yaml` | `packages` | `mobile`, `admin`, `repo-assets` | reszta | j.w. |
| `pnpm-workspace.yaml` | `packages` | `mobile`, `admin`, `repo-assets` | reszta | j.w. |
| `turbo.json` | (brak w filtrach) | brak | wszystkie | turbo.json **nie jest** w żadnym filtrze → zmiana tylko turbo.json nie uruchamia żadnego joba (luka wykryta — patrz §5) |
| Plik niezwiązany (np. `LICENSE`) | (brak) | brak | wszystkie | ten sam problem co turbo.json |

### Luka w routingu — potwierdzona

`turbo.json` jest manifestem `turbo run` używanym przez `pnpm lint`, `pnpm test`, `pnpm build` (root `package.json` linia: `"lint": "turbo run lint"`). Zmiana `turbo.json` może zmieniać cache, pipeline tasków lub definicje outputs bez uruchamiania żadnego joba CI. To luka bezpieczeństwa dla routingu; zostanie zaadresowana w T22 (dodanie `turbo.json` do filtra `packages` tak, by zmiany triggerowały `mobile`/`admin`/`repo-assets`) — wariant minimalny.

## 5. Wykryte luki (zbiorczo)

| # | Luka | Źródło dowodu | Wpływ |
|---|---|---|---|
| L1 | Brak aggregate gate'a dla branch protection | brak w `ci.yml` takiego joba | wymuszanie jakości wymaga ręcznego utrzymywania listy jobów w branch protection; każdy nowy job wymaga ręcznej zmiany ustawień GitHub |
| L2 | `turbo.json` nie jest w żadnym filtrze path filter | inspekcja `ci.yml` filters | zmiana turbo pipeline nie uruchamia żadnego joba |
| L3 | `Dockerfile` (root lub `admin/Dockerfile`) nie są w filtrach (świadomie lub nie) | inspekcja filtrów; `Dockerfile*` pojawia się w `out of scope` master planu | zmiana Dockerfile nie uruchamia testów (poza T24, który to zaadresuje) |
| L4 | `python -m unittest scripts/test_ci_mobile_path_filter.py` jest częścią `scripts-python` (T21), ale test `test_ci_aggregate` (T22) jeszcze nie istnieje | brak pliku | brak regresji dla T22 |
| L5 | Brak jawnego fail-closed dla unknown `needs.*.result` w obecnych jobach; aggregate musi tę regułę wymuszyć | analiza `if`-ów w `ci.yml` | dziura bezpieczeństwa w brakującym aggregate |
| L6 | Brak jawnego testu „push/schedule → full=true → aggregate wymaga wszystkich jobów" | brak testu | dryf po dodaniu nowych jobów nie zostanie zauważony |
| L7 | Brak jawnego zapisu, że aggregate nie zależy od siebie (brak cyklu `needs: [self]`) | inspekcja `needs` | zabezpieczenie projektowe |
| L8 | Brak mechanizmu wykrycia, czy `changes` failed (path routing zepsuty) — obecne joby milcząco się pomijają | inspekcja `if` (żaden nie wymaga `changes.result == 'success'`) | cicha regresja routingu |
| L9 | `workflow_dispatch` nie jest obsłużone w `if` `full` (default `false`) | inspekcja `if` | manualny przebieg może nie wykonać full check; aggregate powinien obsłużyć obie ścieżki |

## 6. Projekt aggregate checka

### Nazwa (stabilna, widoczna w GitHub Checks UI)
- **`Aggregate CI gate`** (job name = identyczne; check name w GitHub = identyczne; nie zmienia się po refaktorze wewnętrznym).

### Identyfikator w PR-owej wypowiedzi (do Code Review)
- W opisie PR i raportach: „Aggregate CI gate" (kanoniczne brzmienie).

### Lokalizacja implementacji
- Skrypt: **`scripts/check_ci_aggregate.py`** (nowy).
- Testy: **`scripts/test_ci_aggregate.py`** (nowy, komplementarnie do `test_ci_mobile_path_filter.py`).
- Zmiana workflow: **`scripts-python`** job w `.github/workflows/ci.yml` (dodanie nowego kroku uruchamiającego testy aggregate); **nowy job `aggregate`** na końcu `ci.yml`.

### Struktura nowego joba `aggregate` (szkielet YAML)

```yaml
  aggregate:
    name: Aggregate CI gate
    runs-on: ubuntu-latest
    needs:
      - changes
      - backend
      - telemetry
      - mobile
      - admin
      - scripts-python
      - repo-assets
      - docs-links
      - audit
      - e2e
      - security
      - trivy
    if: always()           # wymusza uruchomienie nawet jeśli upstream failed/cancelled
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - name: Run aggregate policy check
        env:
          NEEDS_JSON: ${{ toJSON(needs) }}
          EVENT_NAME: ${{ github.event_name }}
          WORKFLOW_CHANGED: ${{ needs.changes.outputs.workflow }}
          FULL_OUT: ${{ needs.changes.outputs.full }}
        run: |
          python scripts/check_ci_aggregate.py \
            --needs-json "$NEEDS_JSON" \
            --event "$EVENT_NAME" \
            --workflow-changed "$WORKFLOW_CHANGED" \
            --full-out "$FULL_OUT"
```

Uwagi projektowe:
- `needs: [...]` zawiera **nazwy** jobów (nie potrzeba `needs: [self]` — brak cyklu).
- Brak zależności aggregate od aggregate (brak cyklu).
- `security` jest non-blocking, ale aggregate musi go uwzględnić (jeśli security result == 'success', OK; jeśli 'failure'/'cancelled', aggregate powinien zwrócić failure — patrz polityka).
- `trivy` steps mają `exit-code: '0'`, więc job zwykle `success` — aggregate traktuje go jak każdy inny.

### Polityka aggregate (algorytm w `scripts/check_ci_aggregate.py`)

**Wejścia:**
- `needs-json` (string): JSON ze wszystkimi resultami jobów.
- `event-name`: `push` | `pull_request` | `schedule` | `workflow_dispatch`.
- `workflow-changed`: `"true"` | `"false"` (z `changes.outputs.workflow`).
- `full-out`: `"true"` | `"false"` (z `changes.outputs.full`).

**Tryb pracy (computed na podstawie event/workflow-changed/full):**
- `mode = "full"` gdy `event ∈ {push, schedule}` lub (`event == pull_request` i `workflow-changed == true`) lub `event == workflow_dispatch`.
- `mode = "path"` gdy `event == pull_request` i `workflow-changed == false`.

**Zasada aggregate dla trybu `full`:**
- Wymagane joby: wszystkie z `needs` aggregate (`backend`, `telemetry`, `mobile`, `admin`, `scripts-python`, `repo-assets`, `docs-links`, `audit`, `e2e`, `security`, `trivy`) oraz `changes`.
- Dla każdego wymaganego joba:
  - `result == 'success'` → OK.
  - `result == 'skipped'` → wymaga wyjaśnienia: jeśli `mode == full` i job jest oznaczony jako `if: always()` albo warunek mu zabrania (np. `trivy` ma `if: full == 'true'`) — to w trybie full tryv powinien być success; `skipped` jest akceptowalny tylko gdy job ma `if:` warunek który nie zachodzi i nie jest to `always()`.
  - `result == 'cancelled'` → FAIL (cancelled = upstream failed).
  - `result == 'failure'` → FAIL.
  - `result` inna / brak → FAIL (fail-closed: unknown result = failure).

**Zasada aggregate dla trybu `path`:**
- `changes` musi być `success` (router musi działać).
- Pozostałe joby: akceptowane `success` lub `skipped` (jeśli path filter ich pominął).
- `cancelled` lub `failure` → FAIL.
- `security` non-blocking jest tu traktowany jak blocking: `success` → OK; `failure`/`cancelled` → FAIL. To znaczy, że jeśli ktoś doda `continue-on-error` w security i wyłączy skanowanie, aggregate to złapie.

**Wyjście (exit code):**
- `0` = OK.
- `1` = FAIL; skrypt wypisuje `::error::Aggregate CI gate failed: ...` i tabelę wyników w `##[error]` (czytelne dla GitHub logu).

**Fail-closed:**
- Brak `needs-json` → FAIL.
- `event-name` nierozpoznane → FAIL.
- `needs-json` nierozpoznane (np. `null`) → FAIL.
- Jakikolwiek job z `needs` aggregate ma brakujący/nieoczekiwany status → FAIL.

### Zachowanie `aggregate` względem scheduled runs
- `schedule` → `mode == full`. Wszystkie joby powinny odpalić i być zielone. Skrypt aggregate ma wypisać ostrzeżenie, jeśli scheduled run miał jakikolwiek job `skipped` (coś jest nie tak z routingu w trybie full).

### Zachowanie `aggregate` względem branch protection
- W ustawieniach branch protection `main`: dodać **`Aggregate CI gate`** jako **required status check**.
- **Nie** dodawać poszczególnych jobów (np. `Backend (Django)`, `Mobile (React Native)`) do required — to rola aggregate. Wyjątek: jeśli właściciel chce zachować istniejące required checki (poza scope T22), zalecenie jest w Executor handoff, ale T22 nie zmienia branch protection.

### Zachowanie `aggregate` względem cyklu
- `aggregate` **nie** ma `needs: [aggregate]` (brak self-dependency).
- Żaden inny job nie ma `needs: [aggregate]` (aggregate jest konsumentem, nie dostawcą).
- Weryfikacja w teście `test_aggregate_no_self_cycle()`.

## 7. Projekt testów

Lokalizacja: **`scripts/test_ci_aggregate.py`** (nowy, komplementarny do `test_ci_mobile_path_filter.py`). Framework: `unittest` (spójnie z istniejącym `test_ci_mobile_path_filter.py`, który używa `unittest`). Dodatkowo: `pytest` (już używane przez `scripts/test_check_docs_links.py`).

### Wymagane testy (sekwencja TDD: najpierw „obecny main" → nieprzechodzące, potem po implementacji → zielone)

**T0 — testy walidujące brak implementacji w obecnym `main` (przed T22):**
1. `test_aggregate_job_exists_in_ci_yml` — parsuje `ci.yml`, szuka `jobs.aggregate`; **FAIL na main**.
2. `test_aggregate_script_exists` — sprawdza obecność `scripts/check_ci_aggregate.py`; **FAIL na main**.
3. `test_aggregate_test_script_exists` — sprawdza obecność `scripts/test_ci_aggregate.py`; **FAIL na main**.

**T1 — testy parsera YAML `ci.yml`:**
4. `test_changes_outputs_include_full_and_categories` — `changes.outputs` ma `full`, `backend`, `telemetry`, `mobile`, `admin`, `packages`, `scripts`, `docs`, `workflow`.
5. `test_filters_match_documented_paths` — każdy filtr ma oczekiwane globs.
6. `test_aggregate_needs_lists_all_blocking_jobs` — aggregate ma `needs` obejmujące `changes`, `backend`, `telemetry`, `mobile`, `admin`, `scripts-python`, `repo-assets`, `docs-links`, `audit`, `e2e`, `security`, `trivy`.
7. `test_aggregate_uses_if_always` — aggregate `if` zawiera `always()`.
8. `test_aggregate_has_no_self_dependency` — aggregate `needs` nie zawiera `aggregate`.
9. `test_no_other_job_depends_on_aggregate` — żaden inny job nie ma `needs: [..., aggregate]`.
10. `test_turbo_json_in_packages_filter` — filtr `packages` zawiera `turbo.json` (nowa luka L2; bez tego test zielony NIE dopuszcza merge).

**T2 — testy polityki aggregate (w `scripts/test_ci_aggregate.py`):**

Wejście do polityki: funkcja `evaluate_aggregate(needs_json, event_name, workflow_changed, full_out) -> AggregateResult`.

Scenariusze (`unittest.TestCase`):

11. `test_push_full_all_success_returns_ok` — event=`push`, full=true, wszystkie joby success → OK.
12. `test_pull_request_path_backend_only` — event=`pull_request`, workflow=false, full=false, only `backend` ran → OK.
13. `test_pull_request_path_docs_only` — event=`pull_request`, workflow=false, full=false, only `docs-links` ran → OK.
14. `test_pull_request_workflow_change_full` — event=`pull_request`, workflow=true, full=true → wymaga wszystkich jobów; wszystkie success → OK.
15. `test_pull_request_path_one_job_failure` — event=`pull_request`, workflow=false, full=false, `backend` failed, inne skipped → FAIL.
16. `test_push_full_one_job_cancelled` — event=`push`, full=true, `admin` cancelled → FAIL.
17. `test_push_full_changes_failure` — event=`push`, full=true, `changes` failed → FAIL (router zepsuty).
18. `test_push_full_skipped_unexpected_job` — event=`push`, full=true, jeden z blokujących jobów `skipped` bez uzasadnienia → FAIL.
19. `test_pull_request_path_security_failure` — event=`pull_request`, workflow=false, full=false, `security` failed (non-blocking standardowo) → FAIL (aggregate to podnosi).
20. `test_missing_needs_field_fails_closed` — `needs-json` ma brakujący klucz → FAIL.
21. `test_partial_needs_fails_closed` — `needs-json` nie ma wszystkich jobów z polityki → FAIL.
22. `test_empty_needs_json_fails_closed` — pusty string → FAIL.
23. `test_unknown_result_value_fails_closed` — `result: "weird"` → FAIL.
24. `test_event_workflow_dispatch_uses_full_mode` — `event=workflow_dispatch` → tryb full → wymaga wszystkich jobów.
25. `test_event_schedule_uses_full_mode` — `event=schedule` → tryb full → wymaga wszystkich jobów.
26. `test_aggregate_does_not_depend_on_self` — refleksyjne sprawdzenie `evaluate_aggregate(needs_json)` nie wprowadza cyklu (brak `aggregate` w `needs`).
27. `test_no_secret_leaked_in_output` — skan wyjścia pod kątem wzorców sekretów (`SECRET_KEY = "..."`, `TOKEN = "..."`) — nigdy nie powinny się pojawić (nawet w testach).

**T3 — testy walidatora parsera aggregate:** (w `test_ci_aggregate.py`, pomocniczo)

28. `test_yaml_parse_failure_is_handled` — błędny YAML → wyjątek kontrolowany.
29. `test_aggregate_name_is_stable` — nazwa joba aggregate to dokładnie `Aggregate CI gate` (kanoniczne brzmienie dla GitHub Check UI).

### Test runner
- W `ci.yml` job `scripts-python` dodać krok:
  ```yaml
        - name: Test CI aggregate policy
          run: python -m unittest scripts/test_ci_aggregate.py -v
  ```
- W lokalnym CI smoke: `python -m unittest scripts/test_ci_aggregate.py -v`.

### Regression tests — istniejące
- `python -m unittest scripts/test_ci_mobile_path_filter.py` (T21) — nadal przechodzi.
- `python -m pytest scripts/test_check_docs_links.py` — nadal przechodzi.
- `python -m pytest scripts/test_load_report.py` — nadal przechodzi.

## 8. Dokładny scope plików

### Pliki do zmiany w T22

1. **`.github/workflows/ci.yml`** — edycja istniejącego pliku:
   - dodać filtr `turbo.json` do kategorii `packages` w jobie `changes` (naprawa L2);
   - dodać nowy krok w jobie `scripts-python`:
     ```yaml
       - name: Test CI aggregate policy
         run: python -m unittest scripts/test_ci_aggregate.py -v
     ```
   - dodać nowy job `aggregate` zgodnie z projektem w §6 (pełny YAML, `needs`, `if: always()`, kroki `actions/checkout@v6`, `actions/setup-python@v6`, `python scripts/check_ci_aggregate.py` z env zmiennymi).

2. **`scripts/check_ci_aggregate.py`** — nowy plik (implementacja polityki):
   - biblioteki standardowe: `argparse`, `json`, `os`, `sys`;
   - stałe: `REQUIRED_NEEDS`, `ACCEPTABLE_RESULTS`, `MODE_FULL_EVENTS`, `POLICY_VERSION = "1"`;
   - funkcja `parse_args()`, `load_needs_json(args.needs_json)`, `compute_mode(event_name, workflow_changed, full_out)`, `evaluate_aggregate(needs, mode)`, `format_failure_report(result)`, `main()`;
   - wejście: CLI z `--needs-json`, `--event`, `--workflow-changed`, `--full-out`;
   - wyjście: `0` (OK) lub `1` (FAIL); `print` z tabelą wyników; `sys.exit(code)`.

3. **`scripts/test_ci_aggregate.py`** — nowy plik (unittest):
   - stałe: helpery do budowy fikcyjnych `needs` JSON;
   - `class AggregatePolicyTests(unittest.TestCase)` z testami 11–27;
   - `class AggregateWorkflowParsingTests(unittest.TestCase)` z testami 1–10, 28–29.

4. **`docs/TAKEOVER_CLEANUP_PLAN.md`** — aktualizacja statusów (dokładne zmiany opisane w §9).

### Pliki wyłącznie odczytywane (kontekst)
- `scripts/test_ci_mobile_path_filter.py` (wzorzec testów).
- `pyproject.toml` (root) — konfiguracja Ruff.
- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `turbo.json` — kontekst dla filtra path routing.

### Pliki poza zakresem (wyraźny zakaz)
- `.github/workflows/docker-publish.yml` — T24, nie T22.
- Wszelkie `Dockerfile*`, konfiguracja build context, registry.
- `backend/`, `telemetry/`, `admin/`, `mobile/`, `packages/` (kod źródłowy komponentów).
- `package.json`, `pnpm-lock.yaml`, `.npmrc`, `pnpm-workspace.yaml`, `backend/requirements.txt`, `telemetry/requirements.txt` (zależności i lockfile).
- Konfiguracja branch protection (T22 jej nie zmienia; zalecenie w Executor handoff).
- PR #47 (T01), PR #60 (T00) — zamknięte i scalone.
- `.kilo/plans/*.md` — nietknięte.

### Branch / commit
- Branch: `ci/required-aggregate-check`.
- Tytuł PR (Draft): `ci: add aggregate CI gate and tighten path routing`.
- Commit message: `ci: add Aggregate CI gate job and tighten path routing (T22)`.
- Squash-merge do `main` zgodnie z regułą z master planu (jedna transza = jeden commit).

## 9. Zmiany statusów master planu (`docs/TAKEOVER_CLEANUP_PLAN.md`)

### Sekcje do aktualizacji
1. **Nagłówek:** `Aktualny main HEAD: df2f5fe` → `Aktualny main HEAD: b03fb9e`.
2. **Nagłówek:** dodać zdanie: `W `Main HEAD` odzwierciedla stan po merge T00 (squash `b16792cc…`) i T21 (squash `b03fb9e…`); PR #47 (T01) pozostaje Draft i BLOCKED.`
3. **Tabela STATUS:**
   - T00: `ACTIVE` → `DONE`; gałąź `docs/takeover-cleanup-plan` (bez zmiany); Zależności: `—` (bez zmiany); PR `ten PR` → `—` (scalony).
   - T21: `ACTIVE` → `DONE`; gałąź `ci/mobile-path-filter-integrity` (bez zmiany); Zależności: `—`; PR `#59` → `—` (scalony).
   - T22: `PLANNED` → `ACTIVE`; gałąź `ci/required-aggregate-check` (bez zmiany); Zależności: `T21` (już DONE — słowo `T21` pozostaje dla spójności topologicznej); PR `—` → `ten PR`.
4. **Master plan – ordered execution:** zmiana opisu T22 na:
   `4. T22 CI path routing + aggregate check (T22 zależy od T21 DONE; realizacja po merge T21).`
5. **Acceptance criteria dla całego programu:** pkt 6 (wymagane bramki CI są stabilne) — dodać wzmiankę: `(`T22` wprowadza Aggregate CI gate; `T23` wzmacnia fail-closed; `T24` przenosi Docker publish pod gate).`
6. **Verification:** dodać komendy T22 do sekcji:
   ```
   - `python scripts/check_ci_aggregate.py` (gdy wprowadzono aggregate gate)
   - `python -m unittest scripts/test_ci_aggregate.py -v`
   ```
7. **Nowa podsekcja w Risks and rollback (master plan):**
   > `T22` dostarcza Aggregate CI gate jako required check; przed włączeniem w branch protection agregat musi przejść co najmniej jeden pełny `push` run bez cancellations. Pierwszy przebieg po merge może wykazać historyczne cancellations — zob. T23.

### Zakazane w master planie (nie zmieniamy w T22)
- Sekcje: „Decyzje właściciela", „Out of scope", „Transza referencyjna – T01", cała tabela poza wierszami T00/T21/T22, „Master plan – ordered execution" pozycje 5–55 (z wyjątkiem pozycji 4 = T22).
- Nie dodajemy w `docs/TAKEOVER_CLEANUP_PLAN.md` informacji o Docker Publish failure (to jest kwestia środowiskowa; zapisujemy w Executor handoff lub issue trackerze, nie w master planie T22).
- Wyjątek: dodanie do T24 (przyszła transza) krótkiej wzmianki w „Risks" odrobinę szerszej niż obecna (pozycja „T21/T22/T23/T24 są technicznym refaktorem CI; błędna konfiguracja może zablokować wszystkie PR-y") — rozszerzona o: `Docker Publish w T24 musi respektować kontekst monorepo (admin/) — nie naprawiamy tego w T22.` Ta uwaga jest informacją, nie implementacją.

## 10. T22 vs granica T24

### Co T22 obejmuje (in-scope)
- `scripts/check_ci_aggregate.py` + `scripts/test_ci_aggregate.py`.
- Nowy job `aggregate` w `.github/workflows/ci.yml`.
- Dodanie `turbo.json` do filtra `packages` (naprawa L2).
- Test regresji w `ci.yml` (krok w `scripts-python`).
- Aktualizacja `docs/TAKEOVER_CLEANUP_PLAN.md` dla statusów T00/T21/T22 i drobnych dopisków.

### Co T22 NIE obejmuje (boundary)
- `.github/workflows/docker-publish.yml` — to T24. Docker Publish używa własnego workflow uruchamianego na `push: [master, main]` i `tags: ['v*.*.*']`, nie na PR. Nie wpływa na aggregate `4VELO CI/CD Pipeline` (są to dwa oddzielne workflows).
- `admin/Dockerfile`, `backend/Dockerfile`, `docker-compose*.yml` — T24.
- `infrastructure/k8s/*` — nie w T22; nie w T24.
- Konfiguracja GHCR (`packages: write`) w `docker-publish.yml` — T24.

### Potwierdzona przyczyna Docker failure (dowód)
- Workflow: `.github/workflows/docker-publish.yml` (pobrany z `b03fb9e`).
- `build-backend`: `context: ./backend`, `push: true` → **SUCCESS** (obraz backendu wypchnięty).
- `build-admin`: `context: ./admin`, `push: true` → **FAILURE**.
- `scan`: depends na `build-backend, build-admin` → FAILURE (oba upstream).
- Przyczyna failure `build-admin`: `admin/Dockerfile` oczekuje kontekstu monorepo (potrzebuje `packages/`, `pnpm-workspace.yaml`, potencjalnie innych plików workspace), ale build context to tylko `./admin`. To jest problem kontekstu budowania, nie T22.
- Wniosek: **T22 nie naprawia tego; T22 tylko dostarcza aggregate gate, który NIE będzie wymagał Docker Publish (bo to osobny workflow).**

### Wpływ T22 na Docker Publish workflow
- T22 w ogóle nie dotyka `docker-publish.yml`.
- Aggregate gate w `4VELO CI/CD Pipeline` dotyczy tylko tego workflow (branch protection wymaga `Aggregate CI gate` z `4VELO CI/CD Pipeline`).
- `SPORT Container Registry — Build & Push` pozostaje osobnym checkiem (z własnymi wynikami SUCCESS/FAILURE).
- W obecnym stanie: Docker Publish nie jest required w branch protection (T22 tego nie zmienia); po T24 owner może rozważyć wymaganie `Container Security Scan` lub innego checka z `docker-publish.yml`.

## 11. Rekomendacja kolejności T23 / T24

### Kontekst
- T23: Fail-closed security gates — zależy od T22 (aggregate gate jako „anchor").
- T24: Docker publish gated by CI — zależy od T22 (aggregate jako proxy dla „build backend OK"; docker-publish jest osobnym workflow, więc zależność jest logiczna, nie techniczna).
- Nowy dowód operacyjny (potwierdzony przez użytkownika): Docker Publish rozpoczął się natychmiast po merge T21; backend image wypchnięty, admin build upadł; **brak retry**.

### Wariant A: T22 → T23 → T24 (status quo z master planu)
- **Ryzyka:**
  - T23 implementuje fail-closed gate'ów bezpieczeństwa; dopóki T24 nie naprawi kontekstu admina, `Container Security Scan` (z `docker-publish.yml`) nadal failuje po merge — ale **to nie blokuje merge PR** (bo `docker-publish.yml` nie jest required).
  - Ryzyko regresji: T23 modyfikuje security job (lub dodaje nowy); bez T24 trudno przetestować pełną ścieżkę „merge → build → deploy".
  - **Niskie ryzyko blokady main**, ponieważ Docker Publish jest osobnym workflow.
- **Korzyści:**
  - Każdy T jest mały; odwracalny pojedynczym revertem.
  - Porządkuje ścieżkę security first, build gating second.

### Wariant B: T22 → T24 → T23
- **Ryzyka:**
  - T24 naprawia kontekst admina (i być może wprowadza retry). Jeśli T24 zrobi `docker-publish.yml` fail-closed na poziomie kontekstu admina, ale `Build Admin Image` nadal failuje z innych powodów (np. brak `pnpm` w builderze admina), to merge T24 może być zablokowany, jeśli Docker Publish stanie się required w branch protection.
  - **Wysokie ryzyko blokady main**, bo T24 wprowadza realne zmiany w buildzie obrazu.
  - T24 jest wrażliwe na środowisko (cache, registry, secrets).
- **Korzyści:**
  - Naprawia realny problem operacyjny wcześniej (Docker Publish działa poprawnie dla obu obrazów).
  - T23 zyskuje już poprawione T24 jako kontekst.

### Analiza ryzyka wariantów (macierz)

| Czynnik | Wariant A (T23→T24) | Wariant B (T24→T23) |
|---|---|---|
| Prawdopodobieństwo zablokowania `main` przez T23/T24 | niskie (security job ma `continue-on-error`) | średnie/wysokie (docker build to nie trywialny pipeline) |
| Możliwość rollbacku | wysoka (małe, odizolowane zmiany) | średnia (T24 zmienia build context — rollback może nie odwrócić wypchniętego obrazu) |
| Wartość operacyjna | T23 wzmacnia ochronę; problem Docker pozostaje | Docker Publish naprawiony wcześniej |
| Efekt psychologiczny | mniejszy disruption | szybka wygrana w Docker, ale opóźnienie fail-closed |

### Rekomendacja
**Wariant A (T22 → T23 → T24)** pozostaje rekomendowany, z uzasadnieniem:

1. **Bezpieczeństwo first.** Aggregate gate z T22 jest warunkiem koniecznym do wprowadzenia fail-closed w T23. Bez aggregate brama fail-closed nie ma na czym się oprzeć.
2. **T24 ma wyższe ryzyko blokady.** Docker build dotyka obrazów (cache, registry); po T24 owner może chcieć wymagać `Container Security Scan` w branch protection, co może zablokować merge, jeśli context admina nie zostanie poprawiony wystarczająco. W wariancie A owner widzi T23 najpierw i może ocenić gotowość T24 z większą liczbą danych.
3. **Decyzja o T24 może wymagać decyzji właścicielskiej** (cache strategy, registry retention, signing). Wariant A pozwala na tę dyskusję po T23, kiedy aggregate gate już działa.

**Wyjątek:** jeśli po merge T22 owner stwierdzi, że obecny Docker failure powoduje realne straty operacyjne (np. wypchnięty backend bez admina to zagrożenie dla stagingu), wówczas rekomendacja może się zmienić na Wariant B — ale to decyzja właścicielska, nie planistyczna.

## 12. Acceptance criteria

T22 jest gotowy do Code Review, gdy:

1. `scripts/check_ci_aggregate.py` istnieje, jest parsowalny, uruchamia się z `--help`.
2. `scripts/test_ci_aggregate.py` istnieje, uruchamia się przez `python -m unittest scripts/test_ci_aggregate.py -v` i wszystkie testy zielone (łącznie 27 z §7).
3. `python scripts/check_ci_aggregate.py` z poprawnym wejściem (wszystkie joby success, event=push, full=true) zwraca exit 0.
4. `python scripts/check_ci_aggregate.py` z `needs-json` zawierającym `failure` zwraca exit 1 i wypisuje raport.
5. `python scripts/check_ci_aggregate.py` z pustym `needs-json` zwraca exit 1 (fail-closed).
6. `python scripts/check_ci_aggregate.py` z nierozpoznanym `event-name` zwraca exit 1 (fail-closed).
7. `.github/workflows/ci.yml` zawiera job `aggregate` o dokładnej nazwie `Aggregate CI gate`, z `needs` obejmującym `changes, backend, telemetry, mobile, admin, scripts-python, repo-assets, docs-links, audit, e2e, security, trivy`, z `if: always()`.
8. Job `aggregate` nie ma `needs: [aggregate]` ani `needs: [self]` (brak cyklu).
9. Żaden inny job w `ci.yml` nie ma `needs: [..., aggregate]` (brak cyklu).
10. Filtr `packages` w jobie `changes` zawiera `turbo.json`.
11. Job `scripts-python` ma krok `python -m unittest scripts/test_ci_aggregate.py -v`.
12. Istniejące testy nadal przechodzą: `python -m unittest scripts/test_ci_mobile_path_filter.py`, `python -m pytest scripts/test_check_docs_links.py`, `python -m pytest scripts/test_load_report.py`.
13. `git diff --check` czyste.
14. `git status --short` w PR: `?? .kilo/plans/*.md` (niezmienione) + modyfikacje śledzonych (3 pliki: `ci.yml`, `scripts/check_ci_aggregate.py`, `scripts/test_ci_aggregate.py`, plus `docs/TAKEOVER_CLEANUP_PLAN.md`).
15. Draft PR #X (numer po otwarciu) ma dokładnie 1 commit (squash-friendly), 4 pliki w diff.
16. CI w PR T22 pokazuje `Aggregate CI gate` jako nowy check z wynikiem SUCCESS.
17. CI w PR T22 nie pokazuje regression w istniejących jobach (T21 test nadal zielony).
18. `docs/TAKEOVER_CLEANUP_PLAN.md` ma zaktualizowane statusy T00=DONE, T21=DONE, T22=ACTIVE i poprawiony nagłówek `main HEAD: b03fb9e`.
19. **Working tree:** tracked zmieniony (4 pliki śledzone), untracked `.kilo/plans/*.md` nietknięte.
20. **PR body:** opis PR nie ujawnia żadnej wartości sekretu; `Aggregate CI gate` wymienione jako nowy mechanizm; spis 20 testów aggregate; wyraźne stwierdzenie, że `.github/workflows/docker-publish.yml` nie jest w scope T22.

## 13. Validation commands

Wszystkie w working tree T22 PR, przed push.

### Git
```
git status --short
git rev-parse origin/main                                # oczekiwane: b03fb9e27d1c10dbd26e14ef13a63a9757054ed0
git rev-parse HEAD                                       # commit na ci/required-aggregate-check
git rev-parse HEAD^                                      # parent == b03fb9e
git diff --check
git diff origin/main...HEAD --stat
git diff --name-status origin/main...HEAD
```

### Walidacja parsera ci.yml (Python, jednolinijkowo, gotowe do PowerShell)
**V1 — filtr packages zawiera turbo.json:**
```powershell
python -c "import yaml; t=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); f=t['jobs']['changes']['steps'][1]['with']['filters']; assert 'turbo.json' in f.get('packages',[]), 'turbo.json missing from packages filter'; print('V1 OK')"
```
**V2 — aggregate job ma poprawne `needs`:**
```powershell
python -c "import yaml; t=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); j=t['jobs']['aggregate']; assert j['name']=='Aggregate CI gate', j['name']; expected={'changes','backend','telemetry','mobile','admin','scripts-python','repo-assets','docs-links','audit','e2e','security','trivy'}; got=set(j['needs']); missing=expected-got; extra=got-expected; assert not missing and not extra, f'missing={missing} extra={extra}'; assert 'always()' in j['if'], j['if']; assert 'aggregate' not in got, 'self-cycle'; print('V2 OK')"
```
**V3 — brak innego joba zależnego od aggregate:**
```powershell
python -c "import yaml; t=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); refs=[name for name,j in t['jobs'].items() if name!='aggregate' and 'aggregate' in (j.get('needs') or [])]; assert not refs, f'jobs depending on aggregate: {refs}'; print('V3 OK')"
```

### Walidacja skryptu aggregate
**V4 — scenariusz success (push, full):**
```powershell
python -c "
import json,subprocess
needs={n:{'result':'success'} for n in ['changes','backend','telemetry','mobile','admin','scripts-python','repo-assets','docs-links','audit','e2e','security','trivy']}
env={'NEEDS_JSON':json.dumps(needs),'EVENT_NAME':'push','WORKFLOW_CHANGED':'false','FULL_OUT':'true'}
import os
r=subprocess.run(['python','scripts/check_ci_aggregate.py','--needs-json',env['NEEDS_JSON'],'--event','push','--workflow-changed','false','--full-out','true'],capture_output=True,text=True)
assert r.returncode==0, (r.stdout,r.stderr)
print('V4 OK')
"
```
**V5 — scenariusz failure (pull_request, backend failed):**
```powershell
python -c "
import json,subprocess
needs={n:{'result':'skipped'} for n in ['changes','backend','telemetry','mobile','admin','scripts-python','repo-assets','docs-links','audit','e2e','security','trivy']}
needs['changes']={'result':'success'}
needs['backend']={'result':'failure'}
r=subprocess.run(['python','scripts/check_ci_aggregate.py','--needs-json',json.dumps(needs),'--event','pull_request','--workflow-changed','false','--full-out','false'],capture_output=True,text=True)
assert r.returncode==1, (r.stdout,r.stderr)
print('V5 OK')
"
```
**V6 — fail-closed (puste wejście):**
```powershell
python scripts/check_ci_aggregate.py --needs-json "" --event push --workflow-changed false --full-out true
echo $LASTEXITCODE
# oczekiwane: 1
```

### Testy jednostkowe (unittest)
```
python -m unittest scripts/test_ci_aggregate.py -v
python -m unittest scripts/test_ci_mobile_path_filter.py -v
python -m pytest scripts/test_check_docs_links.py -q
python -m pytest scripts/test_load_report.py -q
```

### Walidacja dokumentacji
```
python scripts/check_docs_links.py
```

### Walidacja ruff dla nowego skryptu
```
ruff check scripts/check_ci_aggregate.py --config pyproject.toml
ruff check scripts/test_ci_aggregate.py --config pyproject.toml
ruff format --check scripts/check_ci_aggregate.py
ruff format --check scripts/test_ci_aggregate.py
```

### Symulacja aggregate — bez sztucznych commitów i bez Docker Publish
- Każdy scenariusz V4–V6 symuluje `needs` JSON bez faktycznego uruchamiania jobów.
- Nie wykonujemy `git commit --allow-empty` ani żadnych push do testów routingu — testy są deterministyczne (Python `unittest`) i nie wymagają CI.

### Walidacja w CI (po otwarciu Draft PR)
- Czekamy na zakończenie checks; `Aggregate CI gate` musi być SUCCESS.
- Inne joby nie powinny wykazać regresji.

## 14. Ryzyka i rollback

### Ryzyka implementacji T22

- **R1: Agregat ocenia niepoprawnie job `security` (non-blocking).** Jeśli owner wyłączy `pip-audit` albo `pnpm audit`, `security.result` pozostanie `success` (bo kroki mają `continue-on-error`). Aggregate może to przeoczyć. **Mitygacja:** aggregate sprawdza, czy security się w ogóle uruchomił (czyli czy miał kroki do wykonania). W trybie `full` jeśli security był skipped, aggregate zwraca FAIL z ostrzeżeniem „security was skipped in full mode".
- **R2: Nowy job `aggregate` spowoduje timeouty.** Jeśli upstream joby się opóźniają, aggregate czeka. Mitygacja: aggregate ma `timeout-minutes: 15` (szybki timeout, bo to tylko Python evaluation).
- **R3: `turbo.json` w filtrze `packages` może triggerować niepotrzebne joby.** Jeśli ktoś zmienia `turbo.json` niechcący (np. formatuje), aggregate wymusi pełen przebieg. Mitygacja: to pożądane zachowanie — turbo.json kontroluje pipeline tasków.
- **R4: `needs` aggregate musi być aktualizowane ręcznie przy dodawaniu nowych blokujących jobów.** Mitygacja: V2 walidacja parsera wykrywa brakujące/ekstra potrzeby; dodatkowo test 6 `test_aggregate_needs_lists_all_blocking_jobs` wskazuje deweloperowi konieczność rozszerzenia `REQUIRED_NEEDS` w skrypcie.
- **R5: `event == workflow_dispatch` nie jest obsługiwane w istniejącym `if` dla `full`.** Aggregate traktuje dispatch jako `mode=full` (zgodnie z §6), więc wymaga wszystkich jobów. To może powodować, że ręczny dispatch nie przejdzie, jeśli któryś job się nie wykona. Mitygacja: aggregate ostrzega (ale nie blokuje) dla `event == workflow_dispatch`, jeśli wszystkie joby skipped i full=false.
- **R6: docker-publish.yml nie jest w `needs` aggregate.** Jeśli Docker Publish jest required w branch protection, aggregate go nie wymusi. Mitygacja: aggregate jawnie deklaruje, że **nie obejmuje** Docker Publish; to T24.
- **R7: Brak `AGENTS.md` w repo.** T22 nie tworzy AGENTS.md; opiera się na README.md i master planie.

### Rollback

- T22 = pojedynczy commit (squash-friendly) na `ci/required-aggregate-check` z 4 plikami: `ci.yml`, `scripts/check_ci_aggregate.py`, `scripts/test_ci_aggregate.py`, `docs/TAKEOVER_CLEANUP_PLAN.md`.
- Rollback po merge: **pojedynczy `git revert <commit-sha>`** (bez `--merge`/`-m`; zwykły commit).
- Branch protection po merge: `Aggregate CI gate` jest nowym required; rollback PR odwracający aggregate spowoduje powrót do braku aggregate → `Aggregate CI gate` zniknie. Jeśli branch protection już wymaga tego checka (poza scope T22), rollback może zablokować następne merge. Mitygacja: owner koordynuje z branch protection (nie w scope T22).
- Lokalnie: PR T22 może zostać zamknięty przed merge; gałąź `ci/required-aggregate-check` może pozostać w `origin` (do decyzji właściciela).

### Czego T22 świadomie nie uruchamia i dlaczego

- **Nie uruchamia `docker build`** (ani backend, ani admin). T22 to PR o aggregate gate; buildy obrazów są poza scope. Docker Publish w T24.
- **Nie wykonuje push do `ghcr.io`.** T24.
- **Nie zmienia branch protection.** T22 dostarcza mechanizm; włączenie w branch protection to decyzja właścicielska po zweryfikowaniu aggregate na co najmniej jednym push.
- **Nie modyfikuje `docker-publish.yml`.** T24.
- **Nie wprowadza retry mechanizmu.** T22 ma być deterministyczny.
- **Nie uruchamia scheduled `ci.yml` lokalnie.** Zachowanie scheduled jest testowane w `test_pull_request_workflow_change_full`-equivalent i w T2 testach scenariuszowych.

## 15. Gotowy prompt Code Mode

```
Jesteś agentem implementacyjnym w trybie Code Mode. Wykonaj jedną małą
transzę T22 planu docs/TAKEOVER_CLEANUP_PLAN.md (sekcja „Master plan –
ordered execution", pozycja 4) i nic więcej.

Wejście:
- Katalog roboczy: D:\gem\stunning-pancake
- Gałąź bazowa: origin/main (b03fb9e27d1c10dbd26e14ef13a63a9757054ed0)
- Źródło master planu (nie modyfikuj):
  docs/TAKEOVER_CLEANUP_PLAN.md (na main, po merge T00+T21)
- Docelowa gałąź: ci/required-aggregate-check
- Docelowe pliki w PR (4 śledzone):
  1. .github/workflows/ci.yml
  2. scripts/check_ci_aggregate.py (nowy)
  3. scripts/test_ci_aggregate.py (nowy)
  4. docs/TAKEOVER_CLEANUP_PLAN.md (tylko wiersze T00/T21/T22 + nagłówek)

Korekty w docs/TAKEOVER_CLEANUP_PLAN.md (wyłącznie te):
1. Nagłówek: "Aktualny `main` HEAD: `df2f5fe`" → "Aktualny `main` HEAD: `b03fb9e`".
   Dodaj po nim zdanie: "Stan `Main HEAD` odzwierciedla merge T00 (squash `b16792cc…`)
   i T21 (squash `b03fb9e…`); PR #47 (T01) pozostaje Draft i BLOCKED."
2. Tabela STATUS:
   - T00: ACTIVE → DONE; PR `ten PR` → `—`.
   - T21: ACTIVE → DONE; PR `#59` → `—`.
   - T22: PLANNED → ACTIVE; PR `—` → `ten PR`. Gałąź bez zmian.
3. Master plan – ordered execution, pozycja 4: zamień opis T22 na:
   "4. T22 CI path routing + aggregate check (T22 zależy od T21 DONE; realizacja po merge T21)."
4. Acceptance criteria dla całego programu, pkt 6: rozszerz o
   "`T22` wprowadza Aggregate CI gate; `T23` wzmacnia fail-closed; `T24`
   przenosi Docker publish pod gate."
5. Verification: dodaj dwie komendy:
   - python scripts/check_ci_aggregate.py
   - python -m unittest scripts/test_ci_aggregate.py -v
6. Risks and rollback: dodaj akapit o T22.

Korekty w .github/workflows/ci.yml (wyłącznie te):
A. W jobie `changes`, kroku `dorny/paths-filter@v3`, filtr `packages` dodaj
   linię: `- 'turbo.json'` (po istniejących entries).
B. W jobie `scripts-python`, dodaj nowy krok po istniejącym
   "Test CI mobile path routing":
        - name: Test CI aggregate policy
          run: python -m unittest scripts/test_ci_aggregate.py -v
C. Dodaj nowy job `aggregate` na końcu `jobs:` (po `e2e`):
        aggregate:
          name: Aggregate CI gate
          runs-on: ubuntu-latest
          timeout-minutes: 15
          needs:
            - changes
            - backend
            - telemetry
            - mobile
            - admin
            - scripts-python
            - repo-assets
            - docs-links
            - audit
            - e2e
            - security
            - trivy
          if: always()
          steps:
            - uses: actions/checkout@v6
            - uses: actions/setup-python@v6
              with:
                python-version: ${{ env.PYTHON_VERSION }}
            - name: Run aggregate policy check
              env:
                NEEDS_JSON: ${{ toJSON(needs) }}
              run: |
                python scripts/check_ci_aggregate.py \
                  --needs-json "$NEEDS_JSON" \
                  --event "${{ github.event_name }}" \
                  --workflow-changed "${{ needs.changes.outputs.workflow }}" \
                  --full-out "${{ needs.changes.outputs.full }}"

Nowe pliki:

scripts/check_ci_aggregate.py — pełna implementacja polityki aggregate:
- argparse z --needs-json, --event, --workflow-changed, --full-out
- REQUIRED_NEEDS = {"changes","backend","telemetry","mobile","admin",
   "scripts-python","repo-assets","docs-links","audit","e2e","security",
   "trivy"}
- MODE_FULL_EVENTS = {"push","schedule","workflow_dispatch"}
- evaluate_aggregate(needs_dict, mode) -> AggregateResult
  (mode == "full": wszystkie muszą być 'success'; 'cancelled' lub
   'failure' = FAIL; brakujące/nieznane = FAIL)
  (mode == "path": 'changes' musi być success; inne success lub skipped;
   cancelled/failure = FAIL)
- fail-closed dla pustego/nieprawidłowego wejścia
- exit 0 OK; exit 1 FAIL; drukuje tabelę wyników

scripts/test_ci_aggregate.py — unittest z 27 testami:
- T0 (3 testy istnienia): aggregate_job_exists_in_ci_yml,
  aggregate_script_exists, aggregate_test_script_exists
- T1 (7 testów parsera): test 4-10 z §7 planu
- T2 (13 testów polityki): test 11-23 z §7
- T3 (2 testy pomocnicze): yaml_parse_failure_is_handled,
  aggregate_name_is_stable
- T2.26-27: aggregate_does_not_depend_on_self,
  no_secret_leaked_in_output

Kroki Code Mode (każda komenda gotowa do wklejenia w PowerShell):

1. git switch main; git fetch origin; git rev-parse origin/main
   (oczekiwane: b03fb9e27d1c10dbd26e14ef13a63a9757054ed0)
   git status --short
2. git switch -c ci/required-aggregate-check origin/main
3. Sprawdź istnienie plików: scripts/test_ci_mobile_path_filter.py,
   scripts/check_docs_links.py, scripts/test_load_report.py
   (bez ich modyfikacji).
4. Zastosuj korekty 1-6 do docs/TAKEOVER_CLEANUP_PLAN.md.
5. Zastosuj korekty A-C do .github/workflows/ci.yml.
6. Utwórz scripts/check_ci_aggregate.py i scripts/test_ci_aggregate.py.
7. Walidacja lokalna:
   git diff --check
   python scripts/check_docs_links.py
   ruff check scripts/check_ci_aggregate.py scripts/test_ci_aggregate.py --config pyproject.toml
   ruff format --check scripts/check_ci_aggregate.py scripts/test_ci_aggregate.py
   python -m unittest scripts/test_ci_aggregate.py -v
   python -m unittest scripts/test_ci_mobile_path_filter.py -v
   python -m pytest scripts/test_check_docs_links.py scripts/test_load_report.py -q
   python -c "<V1: turbo.json w packages filter>"
   python -c "<V2: aggregate needs correct>"
   python -c "<V3: brak innego joba z needs: [aggregate]>"
8. Sprawdź zakres:
   git diff --stat origin/main...HEAD
   git diff --name-status origin/main...HEAD
   (oczekiwane: 4 śledzone pliki + working tree z .kilo/plans/*.md untracked)
9. Single commit:
   git add .github/workflows/ci.yml scripts/check_ci_aggregate.py scripts/test_ci_aggregate.py docs/TAKEOVER_CLEANUP_PLAN.md
   git commit -m "ci: add Aggregate CI gate job and tighten path routing (T22)"
   git log -1 --format="%H %s"
10. Plain push:
    git push -u origin ci/required-aggregate-check
    (gdyby non-fast-forward: STOP, diagnostyka jak w T00)
11. Otwarcie Draft PR:
    Plik tymczasowy PR body (poza repo):
    C:\Users\akarn\AppData\Local\Temp\kilo\t22-pr-body.md
    z treścią: scope (4 pliki), referencja do master planu T22,
    wykaz 27 testów, zachowanie aggregate w 4 trybach (push, schedule,
    workflow_dispatch, pull_request), granica T22/T24 (docker-publish.yml
    NIE jest w scope), zalecenie owner: włączenie Aggregate CI gate w
    branch protection PO co najmniej jednym push run z sukcesem.
    gh pr create --base main --head ci/required-aggregate-check \
      --title "ci: add Aggregate CI gate and tighten path routing (T22)" \
      --body-file "C:\Users\akarn\AppData\Local\Temp\kilo\t22-pr-body.md" \
      --draft
    Następnie usunięcie pliku tymczasowego.
12. Czekaj na checks (gh pr checks --watch); w szczególności "Aggregate CI gate"
    musi być SUCCESS.
13. Raport końcowy:
    - lokalny HEAD == origin HEAD == PR head SHA
    - 1 commit, 4 pliki w diff, .kilo/plans/*.md nietknięte
    - wyniki V1–V3, ruff, V4–V6, unittest
    - Aggregate CI gate: SUCCESS
    - PR nadal Draft

Zasady:
- BEZ git reset --hard, git commit --amend po push,
  git push --force, git push --force-with-lease.
- BEZ modyfikacji: scripts/test_ci_mobile_path_filter.py,
  scripts/check_docs_links.py, scripts/test_load_report.py,
  scripts/test_check_config_secrets.py,
  .github/workflows/docker-publish.yml,
  Dockerfile*, docker-compose*.yml,
  backend/, telemetry/, admin/, mobile/, packages/,
  pnpm-lock.yaml, package.json (poza filtrem turbo.json),
  backend/requirements.txt, telemetry/requirements.txt,
  .kilo/plans/*.md.
- BEZ ujawniania wartości sekretów (SECRET_KEY, JWT_SIGNING_KEY,
  GHCR tokens, Railway secrets).
- BEZ merge PR T22, T21, T01 (PR #47, #59, #60 są scalone lub Draft;
  T22 PR pozostaje Draft).
- BEZ zmian branch protection w repo (T22 dostarcza mechanizm;
  włączenie required status check to decyzja właścicielska).
- W razie rozbieżności: STOP, opis dowodów, zapytaj.
```

## Open decisions

Brak otwartych decyzji wymagających potwierdzenia właściciela PRZED implementacją T22. Decyzje odroczone (po merge T22, należą do właściciela):

- Włączenie `Aggregate CI gate` w branch protection dla `main` (po co najmniej jednym push run z sukcesem).
- Decyzja T23 vs T24 kolejności (Wariant A vs B) — rekomendacja: Wariant A, ale owner może zmienić.
- Decyzja o ewentualnym retry w Docker Publish (T24).

Te decyzje są zapisane w Executor handoff (Code Mode prompt §15) i w Risks and rollback (§14), ale **nie blokują** implementacji T22.
