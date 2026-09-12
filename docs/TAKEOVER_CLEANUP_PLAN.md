# 4VELO — Master Cleanup Plan

Ścieżka: Home lab (obowiązkowy RC gate) → Railway (docelowa produkcja) → Kubernetes (eksperymentalny).
Aktualny `main` HEAD: `1f6dfcb`. Zakres RC = krytyczna ścieżka użytkownika (logowanie → zapis/synchronizacja aktywności → ingest telemetrii → przegląd w adminie). Pozostałe funkcje (AI, symulatory, Citus, Electron) są poza RC.

Każda transza = jeden mały PR (jedna gałąź → jedna odpowiedzialność → review). Preferowany jest jeden commit; poprawki wynikające z Code Review mogą być dodatkowymi commitami w tym samym PR. Merge wykonujemy metodą squash, aby transza trafiła do `main` jako jeden commit. Wszystkie transze respektują granice PR #44 (Compose prod Dockerfile) i PR #51/#57 (home lab + release gate). Open PR-y są włączane, a nie powielane. `BLOCKED` jest zawsze zapisany w planie z minimalnym działaniem potrzebnym do zdjęcia blokady.

## Decyzje właściciela (potwierdzone)

- Główna ścieżka produkcji: Home lab → Railway (K8s oznaczony eksperymentalnie).
- Zakres RC: krytyczna ścieżka; AI, symulatory, Citus, Electron, k8s poza RC.
- RC = home lab; minimalny staging Railway po RC potwierdza jedynie „deployability".
- Backup/RPO: 24h / RTO: 4h, udokumentowane w izolowanym środowisku.
- Retencja GPS: 30 dni (ujednolicona z `live_position_events`).
- MFA obowiązkowe dla wszystkich ról administracyjnych; istniejący admin przechodzi przez ograniczoną sesję rejestracji MFA.
- Izolacja tenantów: ORM jako pierwsza warstwa + RLS dla krytycznych modeli (`activities_activity`, `activities_poi`, `activities_voucher`, `users_department`, `users_userdepartment`).
- Demo seed, wipe i symulatory: tylko izolowany home lab; staging i produkcja fail-closed (`RUN_DEMO_SEED=0`, `RUN_WIPE=0`).
- HSTS i secure cookies: produkcja 1 rok + `Secure=True`; lokalnie HSTS=0 i cookies bez `Secure`.
- ADR 012 duplicate: Mobile Performance → ADR 015 (kompatybilnościowy redirect pod starą ścieżką).
- Legacy Installation/Deployment → wskaźniki (kanoniczne treści w Getting Started i runbookach).
- Mobile design SSOT: as-built (`bootstrap/screens/components`, React Navigation). Układ `app/features` oznaczony jako plan migracji.
- Raporty przejęcia (`REPOSITORY_MAP`, `QUALITY_COMMAND_MATRIX`, `RISK_AND_OWNERSHIP_MAP`): zamrożone snapshoty 2026-09-09; bieżący stan w PROJECT_TAKEOVER i master planie.
- Polityka bezpieczeństwa: runtime HIGH/CRITICAL blokuje; dev-only z terminem.
- Backend gate: pełny pytest na PostGIS + real Redis; lekka SQLite precheck.
- Python deps: bezpośrednie inputy + generowane constraints.
- Język dokumentacji: kanoniczność per dokument (lifecycle per plik).
- LLM proxy poza RC: endpoint zwraca 404 poza home labem, bez klientowego `base_url`.
- Telemetria ingest: osobny krótkotrwały token `aud=telemetry`, wydawany przez backend po sprawdzeniu user/activity/tenant; telemetry weryfikuje HTTP i WS.
- Odbiorcy live/history GPS: zawodnik własnej aktywności; tenant admin/moderator w zakresie roli i tenanta; GLOBAL_OWNER globalnie; brak publicznego GPS.
- Generowany klient API jako kanon: `packages/api-client/src/generated` commitowany + dryft CI.
- EAS ownership: `mobile/app.config.js` i `mobile/eas.json` jako kanoniczne; root pliki są cienkimi shimami lub zostaną usunięte po potwierdzeniu.
- Firebase wyłączony w RC: `EXPO_PUBLIC_ENABLE_FIREBASE` konsumowane przez kod; produkcja wymaga `false`; iOS placeholder odrzucany przez CI.
- Otwarte PR-y (szczególnie #44, #51, #55, #57) są kontynuowane, a nie duplikowane.
- Status techniczny PR (`APPROVE` / `Draft` / `green CI`) i blokery właścicielskie/środowiskowe są rozróżnione: `STATUS` opisuje stan techniczny transzy; ewentualny bloker jest wypisany w `Zależności` jako `BLOCKED — OWNER ACTION REQUIRED` lub `BLOCKED — ENVIRONMENT REQUIRED`. `APPROVE` w Code Review ≠ gotowość do merge, gdy istnieje bloker właścicielski/środowiskowy.

## Stan planu

Status `STATUS`:
- `PLANNED` — zaplanowana, nie rozpoczęta
- `ACTIVE` — w toku (na gałęzi)
- `DONE` — scalona do main
- `BLOCKED` — wymaga właściciela lub środowiska

`ACTIVE` oznacza transzę z otwartym PR. Status `DONE` można nadać dopiero po merge; aktualizacja następuje w pierwszej kolejnej zmianie planu po scaleniu.

| ID | Transza | Priorytet | Status | Gałąź | Zależności | PR |
|----|---------|-----------|--------|-------|------------|----|
| T00 | Publikacja master planu | P0 | DONE | docs/takeover-cleanup-plan | - | #60 |
| T01 | Signing key removal + ci guard | P0 | BLOCKED | security/remove-committed-signing-key | kontynuacja #47 (Draft, APPROVE, BLOCKED — OWNER ACTION REQUIRED) | #47 |
| T02 | Emergency LLM proxy lockdown | P0 | DONE | security/llm-proxy-readonly | - | #66 |
| T03 | Tenant destructive simulator authority | P0 | DONE | security/simulator-global-owner | - | #65 |
| T04 | Tenant moderator privilege review (reszta) | P1 | DONE | security/tenant-moderator-scope | T03 | #68 |
| T05 | Telemetry auth (HTTP + WS) | P0 | PLANNED | security/telemetry-aud-tokens | kontynuacja fix/telemetry-required-jwt | — |
| T06 | Telemetry read/privacy isolation | P0 | PLANNED | security/telemetry-tenant-reads | T05 | — |
| T07 | MFA mandatory for administrators | P0 | DONE | security/mfa-mandatory-admins | - | #69 |
| T08 | OAuth state enforcement + provider binding | P1 | ACTIVE | security/oauth-state-and-binding | - | ten PR |
| T09 | Tenant webhook admin/SSRF | P1 | PLANNED | security/webhook-admin-and-ssrf | - | — |
| T10 | Department/Moderation/Heatmap tenant scope | P1 | PLANNED | security/tenant-orm-gap-fix | - | — |
| T11 | RLS real enforcement (Postgres-only tests) | P1 | PLANNED | security/rls-real-enforcement | T10 | — |
| T12 | B2B billing isolate or disable | P1 | PLANNED | rewards/b2b-isolate-or-disable | - | — |
| T13 | Telemetry packet/batch contract validation | P1 | PLANNED | telemetry/packet-contract | - | — |
| T14 | Telemetry flush/ACK lifecycle | P1 | PLANNED | telemetry/flush-and-ack | T13 | — |
| T15 | Telemetry multi-worker broadcast via Redis | P2 | PLANNED | telemetry/multi-worker-fanout | T06 | — |
| T16 | Mobile HTTP telemetry bearer + WS auth | P0 | PLANNED | mobile/telemetry-bearer-and-ws | T05 | — |
| T17 | Backend startup migrations out of replica | P1 | PLANNED | backend/migrations-job | - | — |
| T18 | Telemetry schema out of worker startup | P1 | PLANNED | telemetry/schema-out-of-startup | T17 | — |
| T19 | True PostGIS pytest backend gate | P1 | PLANNED | ci/backend-postgis-pytest | T11, T17 | — |
| T20 | Telemetry service integration gate | P1 | PLANNED | ci/telemetry-integration | T14, T18 | — |
| T21 | Mobile CI filter + test integrity | P0 | DONE | ci/mobile-path-filter-integrity | - | #59 |
| T22 | CI path routing + aggregate check | P1 | DONE | ci/required-aggregate-check | T21 | #61 |
| T23 | Fail-closed security gates | P1 | PLANNED | ci/security-fail-closed | T22 | — |
| T24 | Docker publish gated by CI | P1 | DONE | ci/docker-publish-gated | T22 | #63 |
| T25 | Quality baseline scripts unified | P2 | PLANNED | scripts/quality-baseline-unified | T19, T20 | — |
| T26 | Audit scripts truthful | P2 | PLANNED | scripts/audit-truthful | T22, T23 | — |
| T27 | Dependency manifest ownership + Dependabot | P2 | PLANNED | deps/manifest-ownership | - | — |
| T28 | Security/dependency inventory (commit-bound) | P1 | PLANNED | docs/dependency-inventory | - | — |
| T29 | Backend Python remediation (one family/PR) | P1 | PLANNED | deps/backend-python-family | T19, T27, T28 | — |
| T30 | Node dev transitive remediation | P2 | PLANNED | deps/node-dev-transitive | T27, T28 | — |
| T31 | DRF/GIS direction decision + prototype | P2 | PLANNED | deps/drfgis-direction | T29 | — |
| T32 | Mobile overrides → pnpm root overrides | P2 | PLANNED | mobile/pnpm-overrides-root | T27 | — |
| T33 | Expo/EAS canonical config + E2E secrets | P1 | PLANNED | mobile/expo-eas-canonical | - | — |
| T34 | Firebase gate + iOS placeholder reject | P1 | PLANNED | mobile/firebase-off-in-rc | T33 | — |
| T35 | Conservative admin dead-code/export cleanup | P2 | PLANNED | admin/dead-exports-cleanup | - | — |
| T36 | Admin MapLibre loader consolidation | P2 | PLANNED | admin/maplibre-loader-unify | - | — |
| T37 | Mobile dead-code and dev-deps prune | P2 | PLANNED | mobile/dead-code-and-devdeps | T21 | — |
| T38 | Tokens content-based check + ownership | P2 | PLANNED | packages/tokens-content-check | - | — |
| T39 | Api-client: mutator + generated + drift CI | P1 | PLANNED | packages/api-client-generated-canon | T21 | — |
| T40 | Decompose `activities/admin_views.py` | P2 | PLANNED | backend/decompose-admin-views | T03, T12 | — |
| T41 | Decompose `activities/services.py` | P2 | PLANNED | backend/decompose-services | - | — |
| T42 | Decompose `activities/simulator_state.py` | P2 | PLANNED | backend/decompose-sim-state | - | — |
| T43 | Decompose `activities/garmin_simulator.py` | P2 | PLANNED | backend/decompose-garmin-sim | - | — |
| T44 | Decompose `users/views.py` | P2 | PLANNED | backend/decompose-users-views | T08 | — |
| T45 | Consolidate runners (run_tests/run_dev/validation_suite/sit) | P2 | PLANNED | backend/consolidate-runners | T19 | — |
| T46 | i18n manifest completeness + lifecycle modes | P1 | PLANNED | docs/i18n-manifest-completeness | po #51 | — |
| T47 | Dev-command normalization (pnpm + typecheck) | P2 | PLANNED | docs/dev-command-normalize | T21 | — |
| T48 | Configuration & deployment truth (INSTALLATION/DEPLOYMENT/CONFIGURATION) | P1 | PLANNED | docs/deployment-truth | T01, T17 | — |
| T49 | Home lab entry integration (post #51/#57) | P1 | PLANNED | docs/home-lab-entry | po #51, #57 | — |
| T50 | ADR identity migration (012 → 015) | P2 | PLANNED | docs/adr-012-to-015 | - | — |
| T51 | Mobile design as-built vs target | P2 | PLANNED | docs/mobile-design-as-built | - | — |
| T52 | Admin roadmap + active runbook reconciliation | P2 | PLANNED | docs/admin-roadmap-reconcile | - | — |
| T53 | Reports/archive lifecycle hardening | P2 | PLANNED | docs/reports-archive-lifecycle | - | — |
| T54 | GTM ownership + claim labelling | P2 | PLANNED | docs/gtm-ownership | - | — |
| T55 | Documentation navigation + takeover updates | P2 | PLANNED | docs/takeover-nav-refresh | T46, T48, T49 | — |
| T56 | Orphan investigation (models.json, Dockerfile.celery*, coverage committed) | P2 | PLANNED | docs/orphan-disposition | - | — |
| T57 | Backup/restore home lab + RPO/RTO evidence | P1 | PLANNED | ops/backup-restore-home-lab | T49 | — |
| T58 | Home lab release gate (`pre_release_check.py` + runbooks) | P1 | PLANNED | ops/release-gate-home-lab | kontynuacja #57 | — |
| T59 | Release candidate declaration | P1 | PLANNED | ops/release-candidate-declare | T58, T57, T19, T20, T46 | — |

## Out of scope

- Publiczne wdrożenie produkcyjne, migracja bazy produkcyjnej, seed produkcyjny, rotacja sekretów poza udokumentowanym planem operacyjnym.
- Aktualizacja dużych wersji frameworków (Django 6, Expo 56, React 20, MapLibre 6, Vitest 5, Orval 8) – traktowane jako migracje, nie kosmetyka.
- AI coaching poza krytyczną ścieżką RC (endpoint `core/llm_proxy.py` domyślnie zwraca 404 w produkcji).
- Kubernetes jako produkcja (eksperymentalny; jedynie manifesty krytyczne dla RC).
- Wymazanie historii Git (owner decision poza programem).
- Integracje płatne/stripe/Strava/Garmin testowane tylko w trybie testowym.

## Master plan – ordered execution

Kolejność minimalizuje ryzyko regresji i respektuje zależności:

1. T00 publikacja master planu (branch + commit).
2. T01 kontynuacja #47, secret removal + ci guard.
3. T21 mobile filter + test integrity.
4. T22 CI path routing + aggregate check (T22 zależy od T21; następuje po merge T21).
5. T24 Docker publish gated by CI (zależy od T22; bezpośrednio po T22, przed kolejnymi transzami wymagającymi merge do main).
6. T19 true PostGIS pytest backend gate (zależy od T11, ale T11 zależy od T10 itd.; realizacja T19-T11 odwrócona jest bezpieczna dopiero po T22).
7. T03 tenant destructive simulator authority.
8. T02 LLM proxy lockdown (read-only poza home labem).
9. T05 telemetry auth (HTTP + WS).
10. T16 mobile telemetry bearer + WS auth.
11. T06 telemetry read/privacy isolation.
12. T07 MFA mandatory for administrators.
13. T08 OAuth state + provider binding.
14. T09 tenant webhook admin/SSRF.
15. T10 department/moderation/heatmap tenant scope.
16. T11 RLS real enforcement.
17. T12 B2B billing isolate or disable.
18. T13 telemetry packet/batch contract.
19. T14 telemetry flush/ACK lifecycle.
20. T15 telemetry multi-worker broadcast (Redis).
21. T17 backend startup migrations out of replica.
22. T18 telemetry schema out of worker startup.
23. T20 telemetry service integration gate.
24. T23 fail-closed security gates (zależy od T22; po T24).
25. T27 dependency manifest ownership + Dependabot.
26. T28 security/dependency inventory (commit-bound).
27. T30 node dev transitive remediation.
28. T32 mobile overrides → pnpm root overrides.
29. T29 backend Python remediation (rodzina/PR).
30. T31 DRF/GIS direction.
31. T33 Expo/EAS canonical config + E2E secrets.
32. T34 Firebase gate + iOS placeholder reject.
33. T39 api-client: mutator + generated + drift CI.
34. T35 conservative admin dead-code/export cleanup.
35. T36 admin MapLibre loader consolidation.
36. T37 mobile dead-code and dev-deps prune.
37. T38 tokens content-based check + ownership.
38. T25 quality baseline scripts unified.
39. T26 audit scripts truthful.
40. T45 consolidate runners.
41. T40–T44 module decomposition (po ustabilizowaniu granic bezpieczeństwa).
42. T46 i18n manifest completeness + lifecycle modes.
43. T47 dev-command normalization.
44. T48 configuration & deployment truth.
45. T49 home lab entry integration (po #51/#57).
46. T50 ADR identity migration (012 → 015).
47. T51 mobile design as-built vs target.
48. T52 admin roadmap + active runbook reconciliation.
49. T53 reports/archive lifecycle hardening.
50. T54 GTM ownership + claim labelling.
51. T55 documentation navigation + takeover updates.
52. T56 orphan investigation (models.json, Dockerfile.celery*, committed coverage).
53. T57 backup/restore home lab + RPO/RTO evidence.
54. T58 home lab release gate (`pre_release_check.py` + runbooks).
55. T59 release candidate declaration.

Każda transza wstawiana jest w istniejący PR (jeżeli odpowiada) lub tworzy nowy PR zgodnie z zasadą „jedna odpowiedzialność → jedna gałąź → jeden mały PR".

## Transza referencyjna – przykład dla T01 (signing key removal + ci guard)

### Scope
- `backend/railway.json` – usunięcie pola `SECRET_KEY` w całości; pozostała struktura JSON (`variables` i pozostałe wpisy) pozostaje bez zmian.
- `backend/celery-worker/railway.json`, `backend/celery-worker-simulation/railway.json`, `celery-worker-routing/railway.json`, `admin/railway.json`, `telemetry/railway.json` – audyt tych samych kluczy.
- `scripts/check_config_secrets.py` (śledzony w `docs/operations/SIGNING_KEY_ROTATION.md`, ale nieobecny w `git ls-files`) – dodanie skryptu z testami.
- `.github/workflows/ci.yml` – dodanie kroku skanowania w jobie `security`.

### Non-scope
- Brak rotacji klucza produkcyjnego (wymaga właściciela i operacji Railway).
- Brak rewrite historii Git.
- Brak aktualizacji zależności.

### Acceptance criteria
- `python scripts/check_config_secrets.py` zwraca exit 0 dla wszystkich śledzonych `railway.json` po usunięciu.
- Skrypt ma co najmniej 4 testy jednostkowe:
  - `SECRET_KEY` jest odrzucane dla placeholder/empty/null,
  - konfiguracja bez kluczy podpisujących jest akceptowana,
  - `JWT_SIGNING_KEY` jest odrzucane niezależnie od wartości,
  - niepoprawny JSON zgłasza błąd walidacji.
- Skrypt raportuje wyłącznie `path: configure <field> in the service secret store` (bez wartości).
- Job `security` w CI wywołuje skrypt i przechodzi.
- `git diff --check` czyste.
- `git status --short` czysty po PR.

### Validation commands
- `python scripts/check_config_secrets.py`
- `python -m pytest scripts/test_check_config_secrets.py -q`
- `python scripts/check_docs_links.py`
- `git diff --check`
- `gh pr checks --watch` (lub `gh run watch`)

### Risks
- Railway może nadal używać commitowanej wartości; owner musi potwierdzić i zrotować PRZED merge.
- Commitowana wartość `SECRET_KEY` nigdy nie może być ujawniona w diff, logach CI, opisie PR ani w commit message. Raporty, skrypty i opisy PR raportują wyłącznie nazwy pól (`SECRET_KEY`, `JWT_SIGNING_KEY`), nigdy wartości.

### Dependencies
- Kontynuacja otwartego PR #47 na gałęzi `security/remove-committed-signing-key` (faktyczna gałąź; nie `security/signing-key-removal`).
- Właściciel potwierdza, że Railway ma niezależny, trwały klucz; jeśli commitowana wartość była kiedykolwiek używana produkcyjnie, wymaga rotacji PRZED merge.

### Branch / commit
- `security/remove-committed-signing-key`
- `security(backend): remove committed SECRET_KEY and guard tracked railway configs`

### Code Mode prompt
```
Jesteś agentem implementacyjnym w trybie Code Mode. Wykonaj jedną małą transzę T01 planu
docs/TAKEOVER_CLEANUP_PLAN.md (sekcja „Transza referencyjna – T01") i nic więcej.

Kroki:
1. `git switch main && git pull --ff-only origin main && git status --short` – potwierdź czyste drzewo.
2. Utwórz gałąź `security/remove-committed-signing-key` (faktyczna gałąź PR #47) z aktualnego main. Nie używaj `security/signing-key-removal`.
3. W `backend/railway.json` usuń pole `SECRET_KEY` w całości; pozostała struktura JSON (`variables` i inne wpisy) pozostaje bez zmian. W pozostałych `*/railway.json` wykonaj audyt bez zmian ich treści.
4. Dodaj `scripts/check_config_secrets.py` z testami w `scripts/test_check_config_secrets.py`:
   - `SECRET_KEY` jest odrzucane dla placeholder/empty/null,
   - konfiguracja bez kluczy podpisujących jest akceptowana,
   - `JWT_SIGNING_KEY` jest odrzucane niezależnie od wartości,
   - niepoprawny JSON zgłasza błąd walidacji.
   - ścieżki z `git ls-files` dla `railway.json`, wyłącznie raportując `path: configure <field> in the service secret store` bez wartości.
5. Dodaj w `.github/workflows/ci.yml` w jobie `security` krok `python scripts/check_config_secrets.py`.
6. Uruchom:
   - `python scripts/check_config_secrets.py`
   - `python -m pytest scripts/test_check_config_secrets.py -q`
   - `python scripts/check_docs_links.py`
   - `git diff --check`
7. Nie modyfikuj niczego poza `backend/railway.json`, nowymi skryptami i `ci.yml`.
8. Pojedynczy commit: `security(backend): remove committed SECRET_KEY and guard tracked railway configs`.
9. Push gałęzi i otwarcie PR. Nie scalaj.
10. Zwróć pełny diff, wyniki wszystkich komend i adres PR.

Zasady:
- Bez `git reset --hard`, `git push --force`, `git push --force-with-lease`.
- Bez globalnego formatowania, bez aktualizacji zależności, bez zmian w dokumentacji.
- Bez ujawniania wartości sekretów w diff, logach ani PR — wyłącznie nazwy pól.
- Jeżeli coś nie jest opisane w scope – zatrzymaj się i zapytaj.
```

### Code Review Mode prompt
```
Jesteś agentem recenzującym w trybie Code Review. Sprawdź PR dla transzy T01 planu
docs/TAKEOVER_CLEANUP_PLAN.md (sekcja „Transza referencyjna – T01").

Sprawdź:
1. Zgodność ze scope (pliki, sekcje, brak zmian poza zakresem).
2. `git diff main...HEAD` – czy nie zawiera sekretów, komentarzy debug, formatowania globalnego.
3. `python scripts/check_config_secrets.py` – czy raportuje tylko ścieżki i pola, bez wartości.
4. `python -m pytest scripts/test_check_config_secrets.py -q` – wszystkie testy zielone.
5. `python scripts/check_docs_links.py` – brak regresji.
6. `.github/workflows/ci.yml` – nowy krok jest blokujący (brak `continue-on-error`), działa na push i PR, nie wprowadza pętli zależności.
7. Brak przypadkowych zmian w innych plikach (package.json, lockfile, dokumentacja, inne railway.json).
8. Komunikat commit i opis PR są zgodne z konwencją i jednoznacznie opisują ryzyko.
9. Weryfikowalność: w opisie PR jest potwierdzenie, że `backend/railway.json` nie zawiera już wartości.
10. W opisie PR jest jawne potwierdzenie, że commitowana wartość `SECRET_KEY` nie pojawia się nigdzie w diff.

Wydaj jeden werdykt:
- `APPROVE`
- `APPROVE WITH NON-BLOCKING NOTES`
- `REQUEST CHANGES`

Każda uwaga blokująca musi zawierać: ścieżkę pliku, konkretne miejsce, dowód problemu,
minimalną poprawkę i test potwierdzający naprawę.

Nie akceptuj rozwiązań, które maskują wartość, pozostawiają `SECRET_KEY` w pliku,
wyłączają bramkę bezpieczeństwa lub pomijają którykolwiek z czterech testów
wymienionych w Acceptance criteria.
```

## Acceptance criteria dla całego programu

Repozytorium może zostać uznane za uporządkowane dopiero, gdy:

1. Aktywna struktura jest opisana w `docs/TAKEOVER_CLEANUP_PLAN.md`, `docs/PROJECT_TAKEOVER.md` i indeksach PL/EN, zgodna z kodem.
2. Brak potwierdzonych nieużywanych plików ani entrypointów (`T56`).
3. Dokumentacja aktywna jest oddzielona od archiwalnej (`T46`, `T53`, `T54`, `T55`).
4. Komendy start/test/build są jednoznaczne (`T19`, `T20`, `T21`, `T25`, `T47`).
5. Konfiguracje wdrożeniowe mają określony status i właściciela (`T48`, `T49`, `T58`).
6. Wymagane bramki CI są stabilne (`T22`, `T23`, `T24`).
7. Zależności krytyczne i wysokiego ryzyka sklasyfikowane (`T27`, `T28`, `T29`, `T30`, `T31`).
8. Duże moduły mają zaplanowane bezpieczne ekstrakcje (`T40–T44`, `T45`).
9. Testy pokrywają krytyczne granice uprawnień i integracji (`T03`, `T07`, `T10`, `T11`, `T12`, `T19`, `T20`).
10. Zweryfikowana ścieżka home lab + minimalny staging Railway (`T49`, `T58`, `T59`).
11. Backup/restore wykonany w izolowanym środowisku, RPO 24h / RTO 4h (`T57`).
12. Aktualny runbook release i rollback (`T58`).
13. `docs/PROJECT_TAKEOVER.md` opisuje aktualny stan na podstawie dowodów.

## Verification

Obowiązkowe kontrole dla każdej transzy:
- `git status --short` czyste po zakończeniu.
- `git diff --check` czyste.
- `python scripts/check_docs_links.py` (gdy zmieniono dokumenty).
- `python scripts/check_docs_i18n.py` (gdy zmieniono pary językowe lub manifest).
- `python scripts/check_openapi_drift.py` (gdy zmieniono `packages/api-client/src/generated`).
- `corepack pnpm --filter admin lint`, `typecheck`, `test:run`, `build` (gdy zmieniono admin/).
- `corepack pnpm --filter mobile lint`, `typecheck`, `test -- --runInBand --ci` (gdy zmieniono mobile/).
- `cd backend && ruff check . && ruff format --check . && mypy --config-file mypy-ci.ini <scoped>` (gdy zmieniono backend/).
- `cd telemetry && ruff check telemetry && ruff format --check telemetry` (gdy zmieniono telemetry/).

Wszystkie komendy są obowiązkowe dla danego scope; brakujące wyniki traktowane jako `BLOCKED`, nie jako `PASS`.

## Risks and rollback

- Każda transza może zostać wycofana pojedynczym revert commit z referencją do PR; nie używamy `git reset --hard`.
- `T01` zależy od potwierdzenia właściciela, że Railway ma niezależny `SECRET_KEY`. Bez tego produkcja nie wystartuje.
- `T03`/`T07`/`T09`/`T10`/`T11` mogą ujawnić istniejące regresje uprawnień; testy muszą być gotowe przed zmianą kodu.
- `T05`/`T06`/`T14`/`T15`/`T16`/`T18` wymagają koordynacji między backend, telemetry i mobile; każda transza zaczyna się od obserwowalności i testów, nie od zmiany kodu.
- `T21`/`T22`/`T23`/`T24` są technicznym refaktorem CI; błędna konfiguracja może zablokować wszystkie PR-y – planowane jako wczesne transze z możliwością revert pojedynczego kroku.
- `T49`/`T57`/`T58` są środowiskowo zależne; brak działającego home lab blokuje całą RC deklarację.

## Operational notes (post-T21)

Po merge T21 backend image został automatycznie wypchnięty przed zakończeniem pełnego CI, a Admin image nie zbudował się przez błędny monorepo build context. Naprawa należy do T24 (`Docker publish gated by CI`).

## T22 – CI path routing + aggregate check

### Scope

- `.github/workflows/ci.yml` – naprawa routingu `audit` (przyjęcie `admin.result == 'skipped'` dla scripts-only bez maskowania failure/cancelled), dodanie joba `aggregate` (`Aggregate CI gate`, `if: always()`, `timeout-minutes: 15`, `needs` obejmujące dokładnie 12 jobów), dodanie kroku uruchamiającego `python scripts/check_ci_aggregate.py` z `CI_NEEDS_JSON` i `CI_EVENT_NAME`.
- `scripts/check_ci_aggregate.py` – nowy, wyłącznie biblioteka standardowa; nie drukuje surowego JSON-a.
- `scripts/test_ci_aggregate.py` – nowe testy (TDD: RED przed implementacją, GREEN po).
- `docs/TAKEOVER_CLEANUP_PLAN.md` – aktualizacja statusów (niniejszy plik).

### Validation commands (T22)

- `python -m unittest scripts/test_ci_aggregate.py -v`
- `python -m unittest scripts/test_ci_mobile_path_filter.py -v`
- `python -m pytest scripts/test_check_docs_links.py scripts/test_load_report.py -q`
- `python scripts/check_docs_links.py`
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))"`
- `git diff --check`
- `python -m ruff check scripts/check_ci_aggregate.py scripts/test_ci_aggregate.py --config pyproject.toml`
- `python -m ruff format --check scripts/check_ci_aggregate.py scripts/test_ci_aggregate.py --config pyproject.toml`

### Merge outcome and branch protection

- Scalony commit: `91bbba638d42e2762bd9dbdf8247a8832e7367e0` (PR #61, squash).
- Branch protection dla `main` została skonfigurowana pomyślnie:
  - `strict = true`
  - required check = `Aggregate CI gate`
  - `app_id = 15368` (GitHub Actions)
  - `enforce_admins = true`
- T22 jest teraz zamknięty; poprzedni wpis `BLOCKED — OWNER ACTION REQUIRED` został rozwiązany przez właścicielskie ustawienie branch protection.
- `turbo.json` nie został sztucznie dodany do filtra `packages` (świadoma decyzja: obecne joby CI używają bezpośrednich `pnpm --filter`, `turbo.json` nie ma potwierdzonego konsumenta w tym workflow).

### Post-T22 test hardening (follow-up)

Pierwsze wzmocnienie testów agregatu (realistyczne fixture `needs`, table-driven per-output, CLI exit-code coverage, direct import bez broad `except`) zostało dostarczone jako osobny PR hardeningowy. Jest to pierwsza walidacja ochrony `main` (PR nie przejdzie, jeśli `Aggregate CI gate` nie zwróci sukcesu).

### Actionlint — deferred do T25

W tej transzy **nie dodano actionlint**. Actionlint należy do T25 (`Quality baseline scripts unified`) i zostanie wprowadzony razem z ujednoliconą bazą jakości.

## T02 – Emergency LLM proxy lockdown (DONE)

### Scope

- `backend/core/llm_proxy.py` — endpoint `/api/llm/proxy/` domyślnie zwraca HTTP 404 (poza home labem / gdy wyłączony); klient nie może nadpisać `base_url`/`apiUrl` (odrzucenie 400 Bad Request w celu ochrony przed SSRF).
- `backend/core/test_llm_proxy.py` — testy jednostkowe pokrywające: domyślny 404, OPTIONS 404/200, odrzucenie custom base_url (400), brak klucza API (503), błędy walidacji (400) oraz proxy do dozwolonego URL serwerowego.
- `docs/TAKEOVER_CLEANUP_PLAN.md` — status i dowody transzy T02 oraz potwierdzenie DONE dla T03 (#65).

### Non-scope

- Brak zmian w kodzie mobilnym `AvatarTrainerService` i `LlmCoachService`.
- Brak kluczy produkcyjnych i zewnętrznych zapytań LLM w CI.

### Acceptance criteria

- Domyślnie żądania do `/api/llm/proxy/` zwracają HTTP 404.
- Przy włączonym `ENABLE_LLM_PROXY=1` / `LLM_PROXY_ENABLED=1` / `HOME_LAB=1`:
  - próba podania przez klienta `base_url`/`apiUrl`/`url` zwraca HTTP 400;
  - poprawne zapytanie trafia wyłącznie pod serwerowy `LLM_API_URL`.
- Wszystkie testy jednostkowe `core/test_llm_proxy.py` przechodzą; scoped Ruff, format-check i `git diff --check` czyste.

### Validation commands (T02)

- `cd backend && python run_pytest.py core/test_llm_proxy.py -v`
- `cd backend && ruff check core/llm_proxy.py core/test_llm_proxy.py`
- `cd backend && ruff format --check core/llm_proxy.py core/test_llm_proxy.py`
- `python scripts/check_docs_links.py`
- `git diff --check`

### Merge outcome

- PR #66 scalono jako `8916aa68c9599fd7ded3b93d3ffa45edb4fef809` po zielonym wymaganym `Aggregate CI gate` dla aktualnego head PR.

## T03 – Tenant destructive simulator authority (DONE)

### Scope

- `backend/activities/admin_views.py` — `POST`/`DELETE` dla batch/live simulatora oraz `POST simulator-reset` wymagają `GLOBAL_OWNER`; bezpieczne odczyty statusu pozostają dostępne dla istniejących ról administracyjnych.
- `backend/activities/test_simulator_authority.py` — test macierzy metod i podpięcia guardów, w tym regresja istniejącego `IsGlobalOwner` dla wipe.
- `.github/workflows/ci.yml` — nowy test działa w blokującym gate `Simulator light tests (pytest)`.
- `docs/TAKEOVER_CLEANUP_PLAN.md` — status i dowody transzy.

### Non-scope

- Brak zmian uprawnień Garmin Simulator i endpointów tylko do odczytu.
- Brak uruchamiania symulatora, wipe, seed, migracji lub operacji środowiskowych.
- Brak zmian ogólnego `IsAdminOrModerator`; pozostały przegląd moderatora należy do T04.

### Acceptance criteria

- Tylko `GLOBAL_OWNER` może rozpocząć lub przerwać batch/live simulator oraz wykonać simulator reset.
- `GLOBAL_OWNER`, `TENANT_ADMIN` i `TENANT_MODERATOR` zachowują odczyt statusu batch/live; role nieadministracyjne są odrzucane.
- Wipe pozostaje ograniczony do `GLOBAL_OWNER`.
- Nowy test oraz istniejące testy status/operational gate przechodzą; scoped Ruff, format-check, mypy i `git diff --check` są czyste.

### Validation commands (T03)

- `cd backend && python run_pytest.py activities/test_simulator_authority.py activities/test_simulator_status_views.py activities/test_simulator_operational_gate.py -m simulator_light -q`
- `cd backend && ruff check activities/admin_views.py activities/test_simulator_authority.py`
- `cd backend && ruff format --check activities/admin_views.py activities/test_simulator_authority.py`
- `cd backend && mypy --config-file mypy-ci.ini activities/admin_views.py`
- `python scripts/check_docs_links.py`
- `git diff --check`

## T04 – Tenant moderator privilege review (DONE)

### Scope

- `backend/activities/admin_views.py` — eksport danych wymaga co najmniej `TENANT_ADMIN`; Garmin Simulator, czyszczenie podsumowania i generowanie zewnętrznych kont wymagają `GLOBAL_OWNER`.
- `backend/activities/leaderboard_views.py` — globalne listowanie, przeliczanie i czyszczenie administracyjnych leaderboardów wymaga `GLOBAL_OWNER`.
- `backend/activities/test_tenant_moderator_scope.py` — macierz guardów, odmowy bez skutków ubocznych oraz pozytywne przypadki dla uprawnionych ról.
- `.github/workflows/ci.yml` — test kontraktu T04 działa w blokującym kroku backendowym `P1 admin pytest`.

### Non-scope

- Brak zmian ogólnego `IsAdminOrModerator`, moderacji aktywności, kolejki moderatora, publikacji draftów wydarzeń i odczytów dashboardu/analityki.
- Brak zmian statusowych odczytów batch/live simulatora chronionych kontraktem T03.
- Brak uruchamiania symulatorów, zewnętrznego Mail.tm, przeliczeń leaderboardów ani eksportu rzeczywistych danych.

### Acceptance criteria

- `TENANT_ADMIN` i `TENANT_MODERATOR` otrzymują HTTP 403 przed wykonaniem operacji Garmin i administracyjnego zarządzania leaderboardami; moderator otrzymuje HTTP 403 przed eksportem danych.
- `GLOBAL_OWNER` zachowuje administrację Garmin/leaderboardami, a `TENANT_ADMIN` zachowuje eksport.
- Zamierzone operacje moderatora — scoped read, approve/reject i kolejka moderacji — pozostają bez zmian.
- Test T04 i adekwatne regresje moderatora przechodzą; test jest wykonywany w blokującym backend CI; scoped Ruff, dokumentacja i `git diff --check` są czyste.

### Validation commands (T04)

- `cd backend && python run_pytest.py activities/test_tenant_moderator_scope.py activities/tests/test_moderation_scope.py activities/test_anomaly_queue.py activities/test_simulator_authority.py -q`
- `cd backend && ruff check activities/admin_views.py activities/leaderboard_views.py activities/test_tenant_moderator_scope.py`
- `cd backend && ruff format --check activities/test_tenant_moderator_scope.py`
- `python -m pytest scripts/test_ci_workflow_contract.py -q`
- `python scripts/check_docs_links.py`
- `git diff --check`

T04 scalono przez PR #68 jako squash `1f6dfcb`; wymagany `Aggregate CI gate` był zielony dla dokładnego HEAD PR.

## T07 – MFA mandatory for administrators (DONE)

Scalone jako squash `038971a86c9c3a725ac055111cbdabd7d86afbe6` (PR #69) po zielonym wymaganym `Aggregate CI gate` dla dokładnego head SHA.

### Scope

- Logowanie hasłem wymaga poprawnego TOTP od administratora z aktywnym MFA; administrator bez konfiguracji otrzymuje wyłącznie ograniczoną sesję rejestracyjną.
- Tokeny administratorów mają jawny dowód `mfa_verified`; backend sprawdza także aktualną rolę z bazy, dzięki czemu token wydany przed awansem roli nie omija MFA.
- OAuth i impersonacja wydają administratorom sesje ograniczone do konfiguracji lub weryfikacji MFA.
- Ograniczona sesja dopuszcza wyłącznie profil i endpointy MFA. Po konfiguracji lub weryfikacji backend wydaje nowe, pełne tokeny.
- `GLOBAL_OWNER`, `TENANT_ADMIN` i `TENANT_MODERATOR` nie mogą wyłączyć MFA. Panel admina udostępnia konfigurację wszystkim tym rolom i obsługuje TOTP przy logowaniu/OAuth.

### Non-scope

- Brak zmian issuer/audience i kontraktu tokenów telemetry (T05).
- Brak zmian polityki ról, czasu życia JWT, recovery codes, SMS/e-mail MFA oraz zależności.
- Brak migracji bazy: istniejące pola TOTP pozostają kanoniczne.

### Acceptance criteria

- Każda rola administracyjna bez MFA może wejść tylko do profilu i konfiguracji MFA; operacje chronione kończą się 401 bez skutków ubocznych.
- Każda rola administracyjna z MFA loguje się tylko z poprawnym TOTP; zwykły użytkownik zachowuje dotychczasowy login.
- Zmiana bieżącej roli użytkownika na administracyjną natychmiast ogranicza wcześniej wydany token bez `mfa_verified`.
- Włączenie lub sesyjna weryfikacja MFA zwraca nowe tokeny z `mfa_verified`; odświeżanie zachowuje ograniczenie.
- Wszystkie role administracyjne mają `required_for_role=true` i nie mogą wyłączyć MFA.
- Testy backendu, typecheck/lint admina, Ruff, dokumentacja i `git diff --check` przechodzą.

### Validation commands (T07)

- `cd backend && python run_pytest.py users/test_jwt_mfa.py users/test_mfa.py users/test_admin.py::TestRolePermissions::test_impersonation_requires_global_owner users/test_admin.py::TestRolePermissions::test_impersonation_succeeds_for_owner -q`
- `cd backend && ruff check users/jwt_auth.py users/jwt_views.py users/mfa_policy.py users/mfa_views.py users/test_jwt_mfa.py core/social_auth.py users/views.py`
- `cd backend && ruff format --check users/jwt_auth.py users/jwt_views.py users/mfa_policy.py users/mfa_views.py users/test_jwt_mfa.py core/social_auth.py users/views.py`
- `pnpm --filter admin typecheck && pnpm --filter admin lint`
- `python scripts/check_docs_links.py`
- `git diff --check`

## T08 – OAuth state enforcement + provider binding (ACTIVE)

Status: `ACTIVE` — PR otwarty na gałęzi `security/oauth-state-and-binding`. Po scaleniu zostanie zaktualizowany na `DONE` ze wskazaniem PR i squash SHA.

### Root cause

`core/social_auth.py::resolve_oauth_state` używał nieatomowej pary `GET` + `DELETE`, nie wiązał stanu z providerem OAuth i nie miał ścisłego allow-list klienta. Brakujący stan cicho powracał do `client="admin"`, a błędy Redis były połykane. To pozwalało na:

* race condition / replay tego samego nonce przed usunięciem,
* atrybut atakującego mógł podstawić `state` z innego providera (Google↔Facebook swap),
* callback mógł wyciec do `client=admin` nawet gdy logowanie zaczęło się dla `mobile`,
* Redis outage powodował ciche użycie domyślnego klienta zamiast 400.

### Scope

* `backend/core/social_auth.py` — `OAuthStateError`, `consume_oauth_state(nonce, *, expected_provider)`, allow-list `ALLOWED_OAUTH_PROVIDERS = ("google", "facebook")`, allow-list `ALLOWED_OAUTH_CLIENTS = ("admin", "mobile")`, atomowy `r.getdel(...)`, walidacja payload (object / provider / client), usunięcie `resolve_oauth_state`.
* `backend/core/google_auth.py` — callback konsumuje i waliduje stan przed wymianą tokena; wiąże stan z `expected_provider="google"`; odrzuca każdy `OAuthStateError` stabilnym HTTP 400; wyprowadza `client` wyłącznie ze zweryfikowanego stanu.
* `backend/core/facebook_auth.py` — symetrycznie z Google: `consume_oauth_state(..., expected_provider="facebook")`, `_oauth_state_error_response`, brak fallbacku do `client="admin"`.
* `backend/core/fake_redis.py` — `FakeRedis.getdel(key)` (kompatybilne z `redis.Redis.getdel`) dla testów.
* `backend/core/oauth_callback_redirect` — wąsko-scoped `OAuthCallbackRedirect(HttpResponseRedirect)` z `allowed_schemes = {"http","https","ftp", MOBILE_DEEP_LINK_SCHEME}`; produkcyjna ścieżka mobile deep-link używa tego helpera, a nie globalnej zmiany Django. Bazowy `HttpResponseRedirectBase.allowed_schemes` pozostaje nietknięty (`["http","https","ftp"]`).
* `backend/core/test_oauth_state.py` — 62 testy: generowanie stanu, normalizacja klienta, macierz odmów callback (Google + Facebook), realna atomowość `getdel`, replay po success / malformed / provider-mismatch, Redis failure fail-closed, realne mobile deep-link redirect (bez patchy na `redirect` / `HttpResponseRedirect` / scheme-validation), query-override, T07 restricted admin flow, login start.
* `.github/workflows/ci.yml` — dodanie `core/test_oauth_state.py` do istniejącego blokującego kroku `P1 admin pytest` (brak `continue-on-error`, brak duplikatu).
* `scripts/test_ci_workflow_contract.py` — klasa `P1AdminPytestT08ContractTests` weryfikująca, że wskazany krok `P1 admin pytest*` zawiera `core/test_oauth_state.py` w `run:`, nie ma `continue-on-error`, oraz nie istnieje żaden inny krok z referencją do tego pliku.

### Non-scope

* Brak startu T09 ani żadnej innej transzy.
* Brak zmian w T01 / PR #47.
* Brak zmian w telemetrii poza T05.
* Brak redizajnu polityki MFA poza wymaganą kompatybilnością T07.
* Brak zmian JWT TTLs / issuer / audience / schematów.
* Brak migracji bazy, brak nowych zależności.
* Brak zmian UI OAuth ani kodu mobilnego.
* Brak globalnej zmiany `HttpResponseRedirect.allowed_schemes` — jedynie per-instancja subclass.
* Brak zmian production throttlingu (DRF AnonRateThrottle / UserRateThrottle / login pozostają nietknięte).
* Brak edycji `.kilo/plans/*.md`.

### State contract

Stan (`payload`) zapisywany przez `store_oauth_state(client, provider)` do `oauth:social:{nonce}` z TTL `OAUTH_STATE_TTL` (default 600s):

```json
{"client": "admin|mobile", "provider": "google|facebook"}
```

Odczyt atomowy przez `consume_oauth_state(nonce, *, expected_provider)`:

* `nonce is None or ""` → `OAuthStateError(code="missing")`.
* Redis exception → `OAuthStateError(code="redis_failure")` (fail-closed, bez fallbacku na klienta).
* Brak wpisu (unknown/expired/replayed) → `OAuthStateError(code="unknown")`.
* Wartość nie jest JSON-em → `OAuthStateError(code="malformed")` (stan skonsumowany).
* Nieobiekt JSON → `OAuthStateError(code="malformed")` (stan skonsumowany).
* Brak `provider` lub `client`, zły typ → `OAuthStateError(code="invalid_payload")` (stan skonsumowany).
* `provider` poza allow-list → `OAuthStateError(code="invalid_payload")` (stan skonsumowany).
* `client` poza allow-list → `OAuthStateError(code="invalid_client")` (stan skonsumowany).
* `provider != expected_provider` → `OAuthStateError(code="provider_mismatch")` (stan skonsumowany).

Stan jest **zawsze** konsumowany (nawet malformed / provider-mismatch) — w przeciwnym razie atakujący mógłby sondować nonces dowolnymi payloadami. Sukces zwraca dict `{"provider": str, "client": str}` (z normalizacji `normalize_client`).

### Allowed-client policy

`normalize_client(raw)` mapuje `"mobile"` na `"mobile"`, wszystko inne (`None`, `""`, `"admin"`, nieznane) na `"admin"`. Callback **nie używa** `request.GET.get("client")` — `client` pochodzi wyłącznie ze zweryfikowanego stanu. Test `test_callback_client_query_param_does_not_override_state` asercja, że `?client=mobile` w query callback nie zmienia trasy.

### Provider binding

* `google_callback` wywołuje `consume_oauth_state(..., expected_provider="google")`.
* `facebook_callback` wywołuje `consume_oauth_state(..., expected_provider="facebook")`.
* Cross-provider state (Google nonce w Facebook callback, Facebook nonce w Google callback) → HTTP 400 z kodem `provider_mismatch`.

### Atomic replay protection

Pojedynczy `r.getdel(_state_key(nonce))`. Brak `r.get(...)` + `r.delete(...)`. Test `test_state_is_consumed_atomically` patchuje `FakeRedis.getdel` i asercja wyłącznie jednego wywołania na poprawny klucz. Replay testy (`test_replay_after_*`) potwierdzają, że po pierwszym (sukces lub odmowa) stanu nie da się ponownie skonsumować.

### Failure behavior

Każdy `OAuthStateError` zwraca:

```
HTTP 400
{"error": "OAuth state rejected: <code>"}
```

`<code>` jest jednym z: `missing`, `redis_failure`, `unknown`, `malformed`, `invalid_payload`, `invalid_client`, `provider_mismatch`. **Nigdy** nie zawiera nonce, tokena, payloadu, sekretu providera, danych użytkownika. Callback nie wykonuje `requests.post`/`requests.get` do providera, nie tworzy użytkownika, nie wystawia JWT i nie buduje redirect URL przed pozytywną walidacją stanu.

### Real mobile redirect handling

`build_auth_redirect(user, client="mobile")` zwraca `{MOBILE_DEEP_LINK_SCHEME}://auth/callback?...`. Domyślny `HttpResponseRedirect` odrzuca nieznane schematy (`DisallowedRedirect`), co w produkcji zablokowałoby legalny mobile deep-link. Rozwiązanie: subclass `OAuthCallbackRedirect(HttpResponseRedirect)` z `allowed_schemes = set(HttpResponseRedirect.allowed_schemes) | {MOBILE_DEEP_LINK_SCHEME}` (per-instancja, nie globalnie). Helper `oauth_callback_redirect(user, *, client)` buduje odpowiedź i jest używany przez oba callbacki. Bazowy `HttpResponseRedirectBase.allowed_schemes` pozostaje `["http","https","ftp"]` — tylko ten subclass ma rozszerzenie. `client` jest walidowany względem `ALLOWED_OAUTH_CLIENTS` przed konstrukcją; URL nigdy nie pochodzi z query. Testy `TestOAuthCallbackRedirectHelper` weryfikują: realna instancja `HttpResponseRedirect`, `Location` header, odmowa `javascript:` / `file:`.

### Deterministic throttle-test isolation

DRF `AnonRateThrottle` jest skonfigurowany na 30/min — pełny suite 62 callback testów przekraczałby ten limit w obrębie jednego okna, produkując 429 i maskując rzeczywistą odmowę T08. Fixture `_reset_throttle_cache` (autouse) czyści `django.core.cache` przed i po każdym teście. Throttle pozostaje aktywny (nie wyłączony), szybkość produkcyjna nie jest zmieniana, ustawienia globalne nietknięte. Izolacja deterministyczna — drugi pełny przebieg suite'u nie zwraca 429.

### T07 compatibility

* `build_auth_redirect` nadal używa `restricted_token_pair_for_user` z `users/jwt_views.py` — administrator OAuth otrzymuje `mfa_setup_required=True` (lub `mfa_verification_required=True`) zamiast `mfa_verified=True`.
* Brak zmian w `users/jwt_views.py`, `users/mfa_policy.py`, `users/mfa_views.py`.
* Test `test_admin_receives_restricted_mfa_token_from_t07` asercja: `restricted_token_pair_for_user(admin).access` → claim `mfa_setup_required`, brak `mfa_verified`.
* Regresja T07: `cd backend && python run_pytest.py users/test_jwt_mfa.py -q` (18 passed).

### Acceptance criteria

* Każdy `OAuthStateError` z `consume_oauth_state` skutkuje HTTP 400 z `{"error": "OAuth state rejected: <code>"}`.
* Brak wywołań `requests.post`/`requests.get`, `find_or_create_oauth_user`, JWT issuance ani budowy redirect URL przed pozytywną walidacją stanu.
* Callback Google akceptuje wyłącznie stan wystawiony dla `google`; callback Facebook wyłącznie dla `facebook`.
* Brak fallbacku `client="admin"` przy brakującym / nieprawidłowym stanie.
* `request.GET["client"]` nie wpływa na wybór klienta.
* Real mobile deep-link redirect (`fourvelo://auth/callback?access=...`) jest zwracany przez oba callbacki bez żadnego patcha na `redirect`, `HttpResponseRedirect` czy walidację schematu.
* Redis outage → HTTP 400 (fail-closed), brak konsumpcji stanu.
* Stan jest zawsze atomowo konsumowany; replay po success / malformed / provider-mismatch → HTTP 400.
* T07 admin restricted token flow pozostaje niezmieniony.
* CI: `core/test_oauth_state.py` działa w blokującym kroku `P1 admin pytest`, brak duplikatu, brak `continue-on-error`. Kontrakt weryfikowany przez `scripts/test_ci_workflow_contract.py::P1AdminPytestT08ContractTests` (4 testy).
* Aggregate contract nietknięty (pełny `scripts.test_ci_aggregate` 59 passed).
* `ruff check` i `ruff format --check` czyste dla 5 zmienionych plików.
* `git diff --check` czysty.
* Brak edycji `.kilo/plans/*.md`.

### Test coverage

`backend/core/test_oauth_state.py` — 62 testy w 8 klasach:

* `TestStateGeneration` (3) — Google + Facebook login zapisuje provider+client; TTL.
* `TestNormalizeClient` (5) — `mobile`, `admin`, inne wartości, pusty, `None`.
* `TestConsumeOAuthState` (18) — missing/empty nonce, unknown, malformed JSON, non-object, missing provider, missing client, invalid client, provider mismatch w obu kierunkach, valid Google + Facebook state, replay po success / malformed / provider-mismatch, Redis failure fail-closed, atomowość `getdel`, izolacja payload.
* `TestOAuthCallbackRedirectHelper` (6) — admin http redirect, mobile deep-link, invalid client ValueError, bazowy `allowed_schemes` nietknięty, subclass akceptuje `fourvelo://`, subclass odrzuca `javascript:` i `file:`.
* `TestGoogleCallbackDenial` (10) i `TestFacebookCallbackDenial` (10) — missing/empty/unknown/malformed/list/missing-provider/missing-client/invalid-client/cross-provider/Redis-failure → HTTP 400, brak side-effects.
* `TestReplayHappyPath` (2) — Google + Facebook replay po success.
* `TestGoogleCallbackPositive` (4) i `TestFacebookCallbackPositive` (2) — admin redirect (real `HttpResponseRedirect`, `Location`), mobile deep-link (real `OAuthCallbackRedirect`, `fourvelo://...`), query-override, T07 restricted admin flow.
* `TestLoginFlow` (2) — Google + Facebook login redirect do providera z `state=`.

### Risks

* Subclass `OAuthCallbackRedirect` jest per-instancja — regresja w `HttpResponseRedirect.allowed_schemes` w przyszłej wersji Django nie wpłynie na subclass (override).
* `consume_oauth_state` sprawdza `expected_provider in ALLOWED_OAUTH_PROVIDERS` — literówka w callbacku (np. `"googlee"`) zostanie odrzucona z kodem `invalid_payload` (programmer error widoczny w logu).
* Throttle cache fixture zakłada, że `django.core.cache` jest skonfigurowane — w produkcji DRF throttle cache jest domyślny. W testach bez Redis cache może wymagać explicit `CACHES` (in-memory domyślny fallback działa).
* Brak koordynacji z mobilem — klient mobilny musi używać tej samej nazwy schematu (`MOBILE_DEEP_LINK_SCHEME` env var, default `fourvelo`) co backend.

### Rollback

Pojedynczy revert squash merge'a tego PR przywraca stan sprzed T08. Przed revert należy:

1. Potwierdzić, że żaden aktywny provider login nie polega na `?state=...` wystawionym przez starą wersję (Redis TTL = 10 min, więc okno jest krótkie).
2. Wyczyścić `oauth:social:*` w Redis (TTL i tak to zrobi).

Brak migracji, brak zmian w lockfile'ach, brak kompatybilności wstecznej do zachowania — revert jest bezpieczny atomowo.

### Validation commands

* `cd backend && python run_pytest.py core/test_oauth_state.py -q` (62 passed, uruchomić dwukrotnie dla determinizmu)
* `cd backend && python run_pytest.py users/test_jwt_mfa.py -q` (18 passed, regresja T07)
* `cd backend && ruff check core/social_auth.py core/google_auth.py core/facebook_auth.py core/test_oauth_state.py core/fake_redis.py`
* `cd backend && ruff format --check core/social_auth.py core/google_auth.py core/facebook_auth.py core/test_oauth_state.py core/fake_redis.py`
* `python -m unittest scripts.test_ci_workflow_contract -v` (60 passed, w tym 4 z `P1AdminPytestT08ContractTests`)
* `python -m unittest scripts.test_ci_aggregate -v` (59 passed)
* `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))"`
* `python scripts/check_docs_links.py`
* `git diff --check`

### Branch / commit

* Branch: `security/oauth-state-and-binding`
* Commit message: `security: enforce OAuth state provider binding`

## T24 – Docker publish gated by CI (DONE)

### Scope

- `.github/workflows/ci.yml` — dodanie triggerów tagów `v*.*.*`, nowego joba `prepare-publish` (walidacja SHA + ścisłego `refs/tags/vX.Y.Z`, brak checkout, `permissions: {}`), nowego joba `publish-containers` wywołującego reusable workflow z wcześniej zwalidowanymi outputami; `aggregate.needs` pozostaje bez zmian; brak cyklu zależności.
- `.github/workflows/docker-publish.yml` — konwersja na callable-only reusable workflow (`on.workflow_call`); usunięcie `docker/metadata-action`, `type=semver`, inferencji z `github.ref`; backend context zachowany (`./backend`), admin context poprawiony (`.` + `admin/Dockerfile`); tagi oparte na full SHA; `:latest` tylko dla `publish_kind == 'branch'`; `version`/`major_minor` tylko dla `publish_kind == 'tag'`; skan korzysta z immutable tagów `sha-<full SHA>` i nigdy `:latest`; brak `continue-on-error`; pinned Trivy action zachowany.
- `.dockerignore` (nowy) — bezpieczne wykluczenia root context dla `admin/Dockerfile` (monorepo root); backend context (`./backend`) nietknięty.
- `scripts/test_ci_workflow_contract.py` (nowy) — TDD RED→GREEN: kontrakty `ci.yml`.
- `scripts/test_docker_publish_workflow_contract.py` (nowy) — TDD RED→GREEN: kontrakty reusable workflow.
- `scripts/test_root_dockerignore_vs_dockerfiles.py` (nowy) — TDD RED→GREEN: `admin/Dockerfile` COPY sources nie mogą być wykluczone.
- `docs/TAKEOVER_CLEANUP_PLAN.md` — niniejszy wpis (status ACTIVE, referencja do Draft PR tej gałęzi). Sekcje niezwiązane z T24 zachowane bez zmian.

### Non-scope

- Brak `check_ci_aggregate.py` (z T22) — nie modyfikowany.
- Brak zmian w istniejących Dockerfile'ach (`backend/Dockerfile`, `admin/Dockerfile`).
- Brak zmian w kodzie aplikacji, zależnościach, lockfile'ach.
- Brak zmian w branch protection ani retencji GHCR.
- Brak zmian w T01, T23, T25, w żadnym `.kilo/plans/*.md`.
- Brak publikacji obrazów, push taga release, merge PR.

### Acceptance criteria

- Tagi `v*.*.*` wyzwalają `push` w CI.
- `prepare-publish`: brak `actions/checkout`, `permissions: {}`, SHA walidowane jako dokładnie 40 znaków `[0-9a-fA-F]`, tag jako `^refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$`, sześć outputów (`allowed`, `publish_kind`, `validated_sha`, `validated_ref`, `version`, `major_minor`); dla nieobsługiwanych refów `allowed=false` bez failu całego CI workflow.
- `publish-containers`: `needs: [aggregate, prepare-publish]`, `if: needs.prepare-publish.outputs.allowed == 'true'`, wywołuje `./.github/workflows/docker-publish.yml`, przekazuje wyłącznie `needs.prepare-publish.outputs.*`, caller permissions `contents: read` / `packages: write` / `security-events: write`.
- `aggregate.needs` niezależny od `publish-containers` (brak cyklu).
- `docker-publish.yml`: wyłącznie `workflow_call`; brak `secrets: inherit`; brak `type=semver`, `docker/metadata-action`, inferencji z `github.ref`/`github.sha`.
- Backend context: `./backend`; admin context: `.` z `admin/Dockerfile`; oba `actions/checkout` używają `inputs.validated_sha`.
- Tagi: zawsze `sha-<full validated SHA>`; `:latest` wyłącznie gdy `publish_kind == 'branch'`; `version`/`major_minor` wyłącznie gdy `publish_kind == 'tag'`.
- Skan Trivy skanuje wyłącznie tagi SHA; brak `:latest` w skanie; brak `continue-on-error`; pinned Trivy action zachowany.
- `.dockerignore` nie ukrywa żadnego pliku COPY z `admin/Dockerfile` (workspace manifests, `admin/`, `packages/`, `mobile/package.json`, `admin/nginx.conf.template`).
- Wszystkie trzy nowe pliki testowe zielone; `test_ci_aggregate.py` i `test_ci_mobile_path_filter.py` nadal zielone.
- YAML obu workflow parsuje się czysto; `ruff check` i `ruff format --check` czyste dla trzech nowych testów.
- `git diff --check` czysty.
- Local Docker build (Admin i Backend) bez `push` — zależne od środowiska (raportowane jako `BLOCKED — ENVIRONMENT REQUIRED` jeśli Docker nieosiągalny lokalnie).

### Validation commands (T24)

- `python -m unittest scripts/test_ci_workflow_contract.py -v`
- `python -m unittest scripts/test_docker_publish_workflow_contract.py -v`
- `python -m unittest scripts/test_root_dockerignore_vs_dockerfiles.py -v`
- `python -m unittest scripts/test_ci_aggregate.py -v`
- `python -m unittest scripts/test_ci_mobile_path_filter.py`
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))"`
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/docker-publish.yml', encoding='utf-8'))"`
- `python -m ruff check scripts/test_ci_workflow_contract.py scripts/test_docker_publish_workflow_contract.py scripts/test_root_dockerignore_vs_dockerfiles.py --config pyproject.toml`
- `python -m ruff format --check scripts/test_ci_workflow_contract.py scripts/test_docker_publish_workflow_contract.py scripts/test_root_dockerignore_vs_dockerfiles.py --config pyproject.toml`
- `git diff --check`
- Lokalne `docker build -f admin/Dockerfile .` i `docker build ./backend` bez `push` (jeśli środowisko pozwala; w przeciwnym razie `BLOCKED — ENVIRONMENT REQUIRED`). Walidacja Admin kontekstu w praktyce jest zapewniana przez blokujący krok `Validate Admin Docker build (no push, blocks PR on context repair)` w istniejącym jobie `admin` (zob. sekcja *PR-safe Admin Docker build validation* poniżej).

### Risks

- Gałąź zawiera nowy job `publish-containers`; jeśli ktoś ustawi `permissions: write-all` na workflow, pierwszy publish mógłby ominąć gate, ale `aggregate` jest w `needs`, więc dopóki gate nie przejdzie, `publish-containers` nie startuje.
- `:latest` jest nadal pushowany, ale wyłącznie po `aggregate == success` i wyłącznie dla gałęzi (`publish_kind == 'branch'`). Tagi release dostają `version` + `major_minor`, nigdy `:latest`.
- Konwersja `docker-publish.yml` na reusable workflow oznacza, że istniejące PR-y uruchamiające ten plik bezpośrednio (jeśli istnieją) zakończyłyby się bezczynnie — żaden taki przypadek nie został zidentyfikowany.
- Caller `publish-containers` w `ci.yml` jest job-level reusable call (`uses:` + `with:` bezpośrednio na joście). Brak `runs-on` i `steps` w callerze — to wymóg składni GitHub Actions dla reusable workflows.
- Każdy obraz (backend i admin) budowany jest dokładnie raz przez `docker/build-push-action@v6`. Lista tagów (pełny SHA + warunkowy `:latest` / `version` / `major_minor`) obliczana jest raz przez `docker/metadata-action@v6` z `type=raw` (bez `type=semver`, bez inferencji z `github.ref`). Brak wielokrotnych buildów dla różnych tagów.

### Single-build, multi-tag design

Reusable workflow `docker-publish.yml` buduje każdy obraz **dokładnie raz**. Kroki:

1. `docker/metadata-action@v6` z listą `type=raw` (bez `type=semver`):
   - Backend: `sha-<full SHA>` zawsze, `latest` gdy `publish_kind == 'branch'`, `version` i `major_minor` gdy `publish_kind == 'tag'`.
   - Admin: `sha-<full SHA>` zawsze, `latest` gdy `publish_kind == 'branch'`, `version` gdy `publish_kind == 'tag'` (admin nie otrzymuje tagu `major_minor`).
2. `docker/build-push-action@v6` (jedno wywołanie per obraz) konsumuje `steps.meta-X.outputs.tags` i pakuje wszystkie tagi w jednym pushu (`push: true`, `cache-from: type=gha`, `cache-to: type=gha,mode=max`, `labels`).

### PR-safe Admin Docker build validation

Ponieważ lokalne środowisko nie ma Docker CLI (raportowane wcześniej jako `BLOCKED — ENVIRONMENT REQUIRED`), walidacja naprawy kontekstu monorepo dla `admin/Dockerfile` jest realizowana w **istniejącym** jobie `admin` w `ci.yml` jako krok blokujący:

```yaml
- name: Validate Admin Docker build (no push, blocks PR on context repair)
  run: |
    docker build \
      --file admin/Dockerfile \
      --tag 4velo-admin-ci:${{ github.sha }} \
      .
  shell: bash
```

Wymagania:

- uruchamiany dla PR gdy `admin`, `packages` lub `workflow` się zmieniły (istniejący `if: needs.changes.outputs.*` joba `admin`);
- brak `docker login`, brak `push` — krok tylko waliduje build;
- failure → `admin` job FAIL → `Aggregate CI gate` FAIL → branch protection blokuje merge;
- brak nowego joba, brak zmiany `aggregate.needs`.

### Follow-up: cache walidacji Admin Docker build

Pomiar pięciu zakończonych przebiegów joba Admin przed zmianą wykazał 28–30 s dla
`Set up pnpm workspace` (w logu potwierdzony hit klucza setup-node opartego o
`pnpm-lock.yaml`). W dwóch przebiegach po wprowadzeniu walidacji Admin Docker build
ten krok trwał 55–59 s. Log niecache'owanego builda pokazał ponowne pobranie 1687
pakietów i około 31,6 s w samej warstwie `pnpm install` obrazu.

Kontrolowany follow-up zachowuje ten sam root context i `admin/Dockerfile`, ale używa
`docker/setup-buildx-action` oraz `docker/build-push-action` z `push: false`, bez
loginu do registry. Warstwy są przechowywane w osobnym GHA cache scope
`admin-pr-validation`; cache publikacyjny T24 i graf `Aggregate CI gate` pozostają
bez zmian. Composite action pnpm jawnie wskazuje root `pnpm-lock.yaml` jako
`cache-dependency-path`.

Pomiar dla tego samego SHA PR (`02c7f45`) potwierdził cold/warm cache. Pierwszy
Buildx validation trwał 207 s i cały job Admin 305 s, ponieważ tworzył oraz
eksportował cache. Kontrolowany rerun zaimportował manifest GHA i oznaczył warstwy
`pnpm install` oraz `pnpm --filter admin build` jako `CACHED`: walidacja trwała 3 s,
a cały job 97 s. Warm build oszczędził 52 s względem ostatniego porównywalnego
niecache'owanego kroku (55 s) i skrócił cały job o 44 s (141 s → 97 s, około 31%).
Cold run jest droższy o 164 s na utworzenie cache; oszczędność pojawia się od
drugiego przebiegu dla zgodnych wejść warstw.

### Dependencies

- Zależność od T22 (`Aggregate CI gate`) spełniona (PR #61 scalony).
- PR #63 scalono jako `1d57137a3443702635963f36e808eaf7533810aa` po zielonym wymaganym `Aggregate CI gate` dla aktualnego head SHA.
- Push run `34689664201` uruchomił publikację dopiero po udanym agregacie dla dokładnie merge SHA; końcowy wynik publikacji jest weryfikowany osobno po merge.
- Brak nowych zależności środowiskowych ani sekretów.

### Branch / commit

- Branch: `ci/docker-publish-gated`
- Commit message: `ci: gate container publishing on validated CI`

## Executor handoff

Cel: doprowadzić repozytorium do stanu opisanego w sekcji „Acceptance criteria dla całego programu" poprzez realizację transz T00–T59 w kolejności z sekcji „Master plan – ordered execution".

Zatwierdzony scope: wszystkie transze T00–T59, każda jako osobny PR zgodnie z zasadą „jedna odpowiedzialność → jedna gałąź → jeden mały PR".

Zakazane zmiany:
- Modyfikacje poza plikami wymienionymi w scope transzy.
- Globalne formatowanie, masowe aktualizacje zależności, historia rewrite.
- Wdrożenia produkcyjne, migracje produkcyjne, seed, wipe, rotacja sekretów.
- Publikacja obrazów, operacje Railway/EAS, płatne usługi zewnętrzne.
- Wyłączanie testów, asercji, reguł lint, progów pokrycia.

Kolejność: T00 → T59 wg sekcji „Master plan – ordered execution". Dopuszczalne jest łączenie sąsiednich transz tylko wtedy, gdy należą do tego samego właściciela i nie powodują konfliktu.

Acceptance criteria: sekcja „Acceptance criteria dla całego programu".

Verification: sekcja „Verification" plus specyficzne komendy dla każdej transzy (wzorzec w „Transza referencyjna – T01").

Wymagania:
- Przed rozpoczęciem: przejrzyj `docs/TAKEOVER_CLEANUP_PLAN.md` w całości i sprawdź aktualny `git status`.
- Po każdej transzy: przejrzyj `git diff main...HEAD` w poszukiwaniu przypadkowych zmian, sekretów, masowego formatowania.
- Po każdej transzy: uruchom pełen zestaw komend weryfikacyjnych odpowiadający scope.
- Po merge każdej transzy: zaktualizuj tabelę `STATUS` w `docs/TAKEOVER_CLEANUP_PLAN.md` (`PLANNED` → `ACTIVE` → `DONE`/`BLOCKED`) i zaktualizuj odpowiednie sekcje.
- W razie jakichkolwiek rozbieżności z planem: zatrzymaj się, opisz dowody i minimalną poprawkę, nie rozszerzaj scope.

W razie niepowodzenia któregokolwiek warunku blokującego (`BLOCKED`): nie zgaduj – zapisz dokładny powód i wymagane minimalne działanie do zdjęcia blokady (decyzja właściciela, dostęp do konta, dane produkcyjne, środowisko itp.).
