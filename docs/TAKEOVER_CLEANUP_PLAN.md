# 4VELO — Master Cleanup Plan

> Od 2026-09-14 zakres i kolejność pilotażu określa [plan częściowego takeoveru](PARTIAL_TAKEOVER_PILOT_PLAN.md). Ten dokument jest backlogiem i historią kontraktów; wykonanie wszystkich T00–T59 nie jest warunkiem pilotażu. Istniejące bramki i zabezpieczenia pozostają obowiązujące.

Ścieżka: Home lab (obowiązkowy RC gate) → Railway (docelowa produkcja) → Kubernetes (eksperymentalny).
Historyczna baza pierwotnego planu: `1f6dfcb` (nie bieżący HEAD). Zakres RC = krytyczna ścieżka użytkownika (logowanie → zapis/synchronizacja aktywności → ingest telemetrii → przegląd w adminie). Pozostałe funkcje (AI, symulatory, Citus, Electron) są poza RC.

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
| T08 | OAuth state enforcement + provider binding | P1 | DONE | security/oauth-state-and-binding | - | #70 |
| T09 | Tenant webhook admin/SSRF | P1 | DONE | security/webhook-admin-and-ssrf | - | #71 |
| T10 | Department/Moderation/Heatmap tenant scope | P1 | DONE | security/tenant-orm-gap-fix | - | #72 |
| T11 | RLS real enforcement (Postgres-only tests) | P1 | DONE | security/rls-real-enforcement | T10; squash 6e0c720599fce7afc7ef1861f9342303d0b0344b | #83 |
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

Historyczna kolejność pełnego programu, nie aktywna kolejka pilotażu. Wybór następnego zadania: [plan częściowego takeoveru](PARTIAL_TAKEOVER_PILOT_PLAN.md).

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

## T09 – Tenant webhook admin/SSRF (DONE)

Scalone PR-em #71 (squash `7b72142853b3d9b88a30059b627e62ae235259f1`) po zielonym wymaganym `Aggregate CI gate` dla dokładnego head SHA. Transza zamyka ochronę webhooków po stronie backendu (SSRF, walidacja URL, autoryzacja endpointu administracyjnego). T10 wykorzystuje ten sam `Aggregate CI gate` do zabezpieczenia warstwy ORM dla Department / Moderation / Heatmap.

## T10 – Department/Moderation/Heatmap tenant scope (DONE)

Status: `DONE` — squash `ed261c8418d1d16127f0c35d169aaecbfe33dc84`, PR #72. T11 (RLS) jest `DONE`, PR #83, squash `6e0c720599fce7afc7ef1861f9342303d0b0344b`.

### Scope

* `backend/users/department_views.py` — `DepartmentAccessPermission` (macierz akcji: mutacje tylko `GLOBAL_OWNER` / tenantowy `TENANT_ADMIN`; `self_join` bez `SPONSOR`; reszta ról odczytuje swój zakres); `get_queryset` i `perform_create` wymuszają `tenant_id`; `assign` / `remove` walidują `user.tenant_id == department.tenant_id`; `self_join` 403 przy braku tenanta; `my` nie ujawnia obcych działów nawet przy niespójnej historii; `users` filtruje po tenancie działu; `UserDepartmentViewSet` tenant-scoped read i admin-only write.
* `backend/users/department_serializers.py` — `tenant` read-only dla ról tenantowych; querysety `parent` / `moderator` / `user_id` / `department_id` ograniczone do tenanta; object-level walidacja spójności tenanta; `GLOBAL_OWNER` wymaga jawnego istniejącego tenanta.
* `backend/users/department_urls.py` — kolejność rejestracji routera (`user-departments` przed `""`), bo trasa `user-departments/` była przesłonięta przez catch-all `(?P<pk>…)/` (zmiana konieczna, aby `UserDepartmentViewSet` był osiągalny).
* `backend/activities/moderation_views.py` — `scope_moderation_queryset(user)` jako SSOT filtrujący po kanonicznym `Activity.tenant_id`; `_get_moderatable_activity` zachowuje 403 dla jawnego cross-tenant i zwraca fail-closed 403 dla roli tenantowej bez tenanta; `ModerationQueueView` nie dopuszcza już globalnego query dla roli tenantowej bez tenanta; `ModerationAssignView` waliduje istnienie, rolę moderacyjną i ten sam tenant aktywności; `assignee_id=None` działa; `ModerationHistoryView` używa tego samego scope.
* `backend/activities/heatmap.py` — `_resolve_heatmap_scope(request)` zwraca `(scope, error_response)`; `?tenant=` nigdy nie jest zaufany dla ról tenantowych; 403 dla braku tenanta / nieaktywnego / bez `has_heatmap_analytics`; `GLOBAL_OWNER` bez `?tenant=` → sentinel `HEATMAP_GLOBAL_SCOPE`; `_build_heatmap_features` filtruje po `Activity.tenant_id`, nie po `user__tenant_id`; `_cache_key` używa efektywnego scope (klucze A / B / global są różne); `_scoped_heatmap_activities` udostępnia queryset dla testów; `analytics_summary_view` z `?department=` rozwiązuje dział w zatwierdzonym scope (spójny filtr dla weekly / daily / best, dodatkowo `Activity.tenant_id` obok `user__departments`).
* `backend/users/test_department_tenant_scope.py`, `backend/activities/test_moderation_tenant_scope.py`, `backend/activities/test_heatmap_tenant_scope.py` — testy TDD; RED wykazane przed implementacją, GREEN po.
* `.github/workflows/ci.yml` — trzy pliki T10 dopisane do istniejącego blokującego kroku `P1 admin pytest` (bez nowego joba, bez `continue-on-error`).
* `scripts/test_ci_workflow_contract.py` — klasa `P1AdminPytestT10ContractTests` weryfikuje obecność wszystkich trzech plików w kroku, brak `continue-on-error`, brak duplikatu, `aggregate.needs` zawiera `backend`, a backend job jest sterowany filtrem `changes.outputs.backend`.

### Non-scope

* Brak `apply_moderation_approve` business-fix (`route_path_id` AttributeError — pre-existing, nie powiązany z tenant scope, nie naprawiony).
* Brak migracji, brak nowych zależności, brak zmian w lockfile.
* Brak zmian w `core/social_auth.py`, `users/jwt_auth.py`, `users/mfa_*`, telemetry, mobile, admin frontend, billing, RBAC poza opisanym zakresem.
* Brak restrukturyzacji `admin_views.py` (approve/reject korzystają z istniejącego `_get_moderatable_activity`).
* Brak RLS / middleware / migracji Postgres — to zakres T11.
* Brak zmian algorytmów `trend_analysis`, `training_load`, `predict_race_time`.

### Role / tenant access matrix (po T10)

| Endpoint | GLOBAL_OWNER | TENANT_ADMIN | TENANT_MODERATOR | ATHLETE | SPONSOR | brak tenanta | anonymous |
|----------|--------------|--------------|------------------|---------|---------|--------------|-----------|
| Department list/retrieve/tree/users/my | all tenants | own tenant | own tenant | own tenant | own tenant | empty (fail-closed) | 401 |
| Department `my` | tylko własne członkostwa | own tenant | own tenant | own tenant | own tenant | empty | 401 |
| Department create/update/destroy | tak (wymaga jawnego tenanta) | tak (wymuszony tenant) | 403 | 403 | 403 | 403 | 401 |
| Department `assign` / `remove` | tak (cross-tenant 400) | tak (cross-tenant 400) | 403 | 403 | 403 | 403 | 401 |
| Department `self_join` | tak (wymaga własnego tenanta) | tak | tak | tak (własny tenant) | 403 | 403 | 401 |
| UserDepartment list/retrieve | all tenants | own tenant | own tenant | own tenant | own tenant | empty | 401 |
| UserDepartment create/update/destroy | tak (walidacja tenanta) | tak (walidacja tenanta) | 403 | 403 | 403 | 403 | 401 |
| Moderation queue | global | own tenant | own tenant | 403 | 403 | empty | 401/403 |
| Moderation approve/reject/assign | global | own tenant (403 cross) | own tenant (403 cross) | 403 | 403 | 403 | 401 |
| Moderation history | global | own tenant | own tenant | 403 | 403 | empty | 401/403 |
| Heatmap bez `?tenant=` | global | own tenant | own tenant | own tenant | own tenant | 403 | 401 |
| Heatmap `?tenant=B` dla roli tenantowej | ign., scope=A | ign., scope=A | ign., scope=A | ign., scope=A | ign., scope=A | 403 | 401 |
| Heatmap `?tenant=` invalid GLOBAL_OWNER | 400 (no fallback) | n/a | n/a | n/a | n/a | n/a | 401 |
| Analytics bez `department` | self | self | self | self | self | self | 401 |
| Analytics `?department=` obcy dział | tak (istniejący) | 404 | 404 | 404 | 404 | 403 | 401 |

### Acceptance criteria

* Anonymous → 401 dla wszystkich endpointów T10.
* Rola tenantowa bez `tenant_id` → 403 lub empty queryset w zależności od endpointu; nigdy nie ujawnia danych.
* Global query dla roli tenantowej bez tenanta jest niemożliwy (queue, assign, history).
* Cross-tenant approve/reject/assign → 403; cross-tenant parent/moderator/user na Department → 400 (queryset lub object-level); niespójna relacja `UserDepartment` nie powoduje przecieku.
* Heatmap filtruje po `Activity.tenant_id`; ten sam bbox/type/zoom dla dwóch tenantów daje różne klucze cache; sentinel `global` nie koliduje z UUID tenantu.
* Analytics z `?department=` używa zatwierdzonego scope; weekly / daily / best korzystają z identycznego filtra.
* Trzy pliki testowe T10 uruchamiane w blokującym kroku `P1 admin pytest`, brak `continue-on-error`, brak duplikatu.
* Aggregate CI gate zależy od backend job i pozostaje zielony dla head SHA Draft PR.

### Test coverage

* `users/test_department_tenant_scope.py` — 33 testy (anon 401, denied mutacje dla ATHLETE/SPONSOR/TENANT_MODERATOR, tenant admin read scope, create force tenant, update no cross-tenant, foreign parent/moderator 400, assign/remove w tenancie, `user-departments` direct POST, self_join scenarios, `my` bez leaku, GLOBAL_OWNER global odczyt i create z tenantem, GLOBAL_OWNER nie tworzy cross-tenant relacji, happy paths).
* `activities/test_moderation_tenant_scope.py` — 23 testy (macierz ról, queue scope, brak tenanta → empty, brak tenanta → 403 approve/reject/assign, cross-tenant 403, assignee foreign tenant 400, assignee disallowed role 400, `assignee_id=None`, history scope bez leaku, history bez tenanta → empty, GLOBAL_OWNER global, reject positive, approve path mock + scope, GLOBAL_OWNER reject pozytywny).
* `activities/test_heatmap_tenant_scope.py` — 25 testy (anon 401, foreign `?tenant=` ignorowany, empty `?tenant=` ignorowany, brak tenanta 403, inactive 403, brak flagi 403, owner global, owner valid tenant, owner invalid → 400 bez fallbacku, ORM filtruje `tenant_id` i nie `user__tenant_id`, niespójność nie leak, global scope widzi oba, klucze cache różne, view używa scope, cache isolation między tenantami, owner invalid 400, bbox walidacje, analytics own department OK, foreign 404, brak tenanta 403, niespójność nie leak, GLOBAL_OWNER department, owner nieistniejący 404, weekly/daily/best share scope).

### CI contract (blokujący)

Krok `P1 admin pytest` zawiera dodatkowo:

* `users/test_department_tenant_scope.py`
* `activities/test_moderation_tenant_scope.py`
* `activities/test_heatmap_tenant_scope.py`

Walidowane przez `scripts/test_ci_workflow_contract.py::P1AdminPytestT10ContractTests`:

* wszystkie trzy pliki obecne w `run:` kroku;
* brak `continue-on-error`;
* brak duplikatu w innym kroku;
* `aggregate.needs` zawiera `backend`;
* backend job jest sterowany filtrem `changes.outputs.backend`.

`scripts.test_ci_aggregate` pozostaje zielony (59 passed).

### Validation commands

* `cd backend && python run_pytest.py users/test_department_tenant_scope.py -q` (33 passed)
* `cd backend && python run_pytest.py activities/test_moderation_tenant_scope.py -q` (23 passed)
* `cd backend && python run_pytest.py activities/test_heatmap_tenant_scope.py -q` (25 passed)
* `cd backend && python run_pytest.py <powyższe trzy> -q` (81 passed)
* `cd backend && python run_pytest.py activities/test_tenant_moderator_scope.py activities/tests/test_moderation_scope.py users/test_jwt_mfa.py core/test_oauth_state.py activities/test_live_map_webhooks.py -q` (regresje T03/T04/T07/T08/T09)
* `cd backend && python -m ruff check users/department_views.py users/department_serializers.py users/test_department_tenant_scope.py activities/moderation_views.py activities/heatmap.py activities/test_moderation_tenant_scope.py activities/test_heatmap_tenant_scope.py`
* `cd backend && python -m ruff format --check <te same pliki>`
* `python -m unittest scripts.test_ci_workflow_contract -v` (69 passed)
* `python -m unittest scripts.test_ci_aggregate -v` (59 passed)
* `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))"`
* `python scripts/check_docs_links.py`
* `git diff --check`

### Risks

* `apply_moderation_approve` zawiera pre-existing `AttributeError` (`route_path_id`) — nie naprawiony (poza scope T10). T10 pozytywny test approve opiera się na mocku scope helper.
* Routing `user-departments` wymagał zmiany kolejności rejestracji — istniejący klienci (frontend) nie powinni być dotknięci, ale zachować ostrożność przy wdrożeniu (zmiana jest minimalna i adresuje realny shadowing bug).
* Heatmap mock geometrii w run_pytest ogranicza testy do scope helper i mocked build; integracyjne testy bbox z PostGIS są BLOCKED — ENVIRONMENT REQUIRED i pozostają domeną CI.

### Rollback

Pojedynczy revert squash merge'a PR T10 przywraca stan sprzed transzy. Brak migracji, brak kompatybilności wstecznej do zachowania. Kroki:

1. Potwierdzić, że żaden Draft PR konsument nie polega na twardym 403 dla history bez tenanta (zachowanie zgodne z dotychczasowym kontraktem dla ról z tenantem).
2. Wyczyścić `heatmap:tile:*` w Redis (TTL = 300 s, więc krótkie okno).

### Dependencies

* Brak nowych zależności środowiskowych ani sekretów.
* Zależność od T22 (`Aggregate CI gate`) spełniona (PR #61 scalony).
* T11 (RLS) jest `DONE`, PR #83, squash `6e0c720599fce7afc7ef1861f9342303d0b0344b`.

### Branch / commit

* Branch: `security/tenant-orm-gap-fix`
* Commit 1: `docs: activate T10 tenant ORM scope`
* Commit 2: `security: enforce tenant scope for departments moderation and heatmaps`
* Squash: `ed261c8418d1d16127f0c35d169aaecbfe33dc84` (PR #72)

## T11 – RLS real enforcement (DONE)

Status: `DONE` — PR #83, squash `6e0c720599fce7afc7ef1861f9342303d0b0344b`; gałąź `security/rls-real-enforcement`. T10 (squash
`ed261c8418d1d16127f0c35d169aaecbfe33dc84`, PR #72) zakończył warstwę ORM;
T11 dodaje niezależną ochronę na poziomie PostgreSQL. Runtime PostgreSQL
pozostaje do walidacji w home lab / Railway (`PARTIAL — ENVIRONMENT
VALIDATION BLOCKED` do czasu pierwszego uruchomienia w docelowym środowisku
z prawdziwym `DATABASE_URL`). T19 pozostaje w swoim statusie.

Decyzja architektoniczna (wiążąca): RLS w T11 chroni pięć tabel kanoniczną
polityką `fourvelo_tenant_isolation` opartą o `TO PUBLIC` (rola runtime),
`ENABLE` + `FORCE ROW LEVEL SECURITY`, dwa GUCy (`app.tenant_id`,
`app.is_global_owner`) ustawiane wyłącznie przez zaufany kod backendu po
uwierzytelnieniu `request.user`. Brak tworzenia osobnych ról PostgreSQL,
brak membership, brak `SET ROLE` w runtime. Rozdzielenie ról
migracyjnej / runtime / administracyjnej jest planowanym hardeningiem
infrastruktury poza T11.

### Scope

* `backend/activities/migrations/0036_canonical_fourvelo_rls.py` — drop wszystkich legacy polityk na `activities_activity`, `activities_poi`, `activities_voucher`; jeden kanoniczny zestaw polityk `fourvelo_tenant_isolation` z `FOR ALL TO PUBLIC`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, jawnym `USING` i `WITH CHECK`, warunek fail-closed: `app.is_global_owner = 'true'` LUB (`app.tenant_id` niepuste AND `tenant_id` niepuste AND `tenant_id = app.tenant_id`). Migracja nie tworzy / nie zmienia / nie usuwa żadnej roli PostgreSQL, nie wymaga `CREATEROLE`, nie wykonuje `GRANT` ani `REVOKE`.
* `backend/users/migrations/0022_canonical_fourvelo_rls.py` — analogicznie dla `users_department` (direct) i `users_userdepartment` (via `users_department.tenant_id`); drop legacy `department_tenant_isolation` / `userdepartment_tenant_isolation`, które polegały na `app.user_id` / `users_user` lookup; `reverse_sql` odtwarza historyczne polityki `tenant_isolation TO PUBLIC` i wyłącza FORCE (zgodnie ze stanem sprzed T11) — nie wykonuje `REVOKE` i nie odwołuje się do `fourvelo_app` / `fourvelo_admin` / `sport_app`.
* `backend/core/rls.py` — helpery dla dwóch GUCów: `set_tenant_context(tenant_id)` (walidacja UUID, czyści flagę global-owner), `set_global_owner_context()` (bez argumentu; czyści `app.tenant_id`; ustawia wyłącznie kanoniczny literal `'true'`), `clear_tenant_context()`, `clear_global_owner_context()`, `clear_all_context()`. Context manager `tenant_context()` i `global_owner_context()` z cleanup obu GUC w `finally`. Brak tworzenia ról, brak interpolowania danych wejściowych do SQL, brak `sport_app`, brak `sport.current_tenant_id`. Helper niskiego poziomu nie przyjmuje niezaufanej wartości query/body/header jako decyzji GLOBAL_OWNER.
* `backend/core/middleware.py` — `TenantRLSMiddleware`: na początku requestu czyści oba GUC (`clear_all_context()`); dla uwierzytelnionego session user `role == GLOBAL_OWNER` ustawia `app.is_global_owner='true'` i czyści `app.tenant_id`; dla session user z `tenant_id` ustawia `app.tenant_id` i czyści flagę globalną; każdy inny przypadek czyści oba. `SKIP_PATHS` jawnie zaczynają i kończą z pustym kontekstem. `finally` czyści oba GUC po poprawnej odpowiedzi, wyjątku i rollbacku — także dla requestów obsłużonych przez DRF JWT (który ustawia GUCy wewnątrz widoku).
* `backend/users/jwt_auth.py` — `MFAEnforcingJWTAuthentication`: po prawidłowym `super().authenticate(request)` ustawia GUCy na podstawie zweryfikowanego `request.user` (rola + tenant_id) — dla `GLOBAL_OWNER` wywołuje `set_global_owner_context()`, dla tenant user `set_tenant_context(tenant_id)`, w innym razie `clear_all_context()`. Scope pochodzi wyłącznie z bazy danych; nie z query/body/header. Klasa czyści GUCy w każdym error path. `TenantRLSMiddleware` nadal odpowiada za końcowy cleanup w `finally` po całym requeście.
* `backend/apply_rls.py` — usunięty (jego jedyny konsument to on sam; migracje są jedynym źródłem prawdy dla polityk).
* `backend/test_rls.py` — realny test integracyjny PostgreSQL RLS. Twardo FAILuje na SQLite. Weryfikuje: (a) metadane (`relrowsecurity`, `relforcerowsecurity`, polityka `TO PUBLIC`, USING, WITH CHECK, oba GUCy w USING), (b) `current_user` nie ma SUPERUSER / BYPASSRLS, (c) izolację per-tabela dla pięciu tabel przez `SET LOCAL ROLE fourvelo_rls_test` (ograniczona rola fixture, NOLOGIN, NOSUPERUSER, NOBYPASSRLS, granty minimalne, usuwana w teardown), (d) relacje pośrednie (`activities_voucher` via `activities_poi`, `users_userdepartment` via `users_department`) bez rekurencji, (e) GLOBAL_OWNER widzi A i B, (f) lifecycle A→B→brak, A→global→brak, finally cleanup po wyjątku, (g) session auth przez `TenantRLSMiddleware._apply_session_scope`, (h) JWT auth przez `MFAEnforcingJWTAuthentication.authenticate`, (i) reverse_sql nie zawiera CREATE ROLE / ALTER ROLE / DROP ROLE / REVOKE / fourvelo_app / fourvelo_admin, (j) round-trip reverse+forward na prawdziwej bazie.
* `.github/workflows/ci.yml` — nowy krok `T11 RLS integration test (PostgreSQL only)` w istniejącym jobie `backend`; service PostGIS zmigrowany do spójnej nazwy 4VELO (`fourvelo_ci / fourvelo_ci_pass / fourvelo_ci`); bez `continue-on-error`, bez SQLite, bez `run_pytest.py`, bez `pip install pytest pytest-django` (instalowane wcześniej w jobie przez `Simulator light tests`).
* `scripts/test_ci_workflow_contract.py` — klasa `T11RLSContractTests` weryfikuje: obecność kroku, brak `continue-on-error`, brak duplikatu, `DATABASE_URL` PostgreSQL, brak SQLite nigdzie, brak `run_pytest.py`, brak `pip install` w kroku, brak legacy `sport_user/sport_pass/sport_test` w jobie backend, obecność `fourvelo_ci` w postgres service, lokalizacja w jobie `backend`, `aggregate.needs` nadal zawiera `backend`.

### Non-scope

- Brak tworzenia `fourvelo_app`, `fourvelo_admin`, `sport_app`, ani żadnej innej roli PostgreSQL w migracjach / helperach / runtime.
- Brak `SET ROLE` w runtime poza testami (fixture tworzy wyłącznie `fourvelo_rls_test`).
- Brak membership między rolami PostgreSQL.
- Brak nowych użytkowników LOGIN PostgreSQL poza fixture testową.
- Brak nowych sekretów produkcyjnych.
- Brak osobnego połączenia administracyjnego.
- Brak zmian modeli biznesowych, lockfile, requirements, Dockerfile.
- Brak zmian w `backend/activities/tasks.py` (Celery), `backend/activities/management/commands/*` i innych workerach — T11 nie przebudowuje tych ścieżek; wszystkie takie miejsca wypisane są jako follow-up. RLS działa tylko wtedy, gdy middleware lub auth class ustawi kontekst.
- Brak automatycznego usunięcia legacy `sport_app` jeśli kiedykolwiek istniał w bazie — poza zakresem.
- Brak zmian w `core/social_auth.py`, telemetry, mobile, admin frontend, billing.
- Brak modyfikacji historycznych migracji RLS (`0006`, `0007`, `0008`, `0014`) — T11 je nadpisuje nowymi migracjami, a `reverse_sql` odtwarza historyczny stan.
- Brak rozszerzania zakresu o testy inne niż pięć chronionych tabel.
- Legacy `sport_app`, `sportuser`, `sportpass`, `sport.current_tenant_id` nie wracają do aktywnej implementacji (testy, helpery, CI, migracje). Mogą wystąpić wyłącznie w historycznych migracjach przed T11, których T11 nie modyfikuje.

### Finalny kontrakt RLS

* Tabele: 5 chronionych (`activities_activity`, `activities_poi`, `activities_voucher`, `users_department`, `users_userdepartment`), wszystkie z `ENABLE` + `FORCE ROW LEVEL SECURITY`.
* Polityka: `fourvelo_tenant_isolation` na każdej z pięciu tabel, `FOR ALL TO PUBLIC`, jawna `USING` i `WITH CHECK`.
* GUC `app.tenant_id`: kanoniczny UUID tenanta. Warunek: `NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL`.
* GUC `app.is_global_owner`: kanoniczny literal `'true'`. Warunek: `current_setting('app.is_global_owner', true) = 'true'`. Każda inna wartość (włącznie z pustą, `'1'`, `'yes'`) jest fail-closed.
* Granica bezpieczeństwa `app.is_global_owner`:
  * użytkownik API nie może ustawić GUC przez query/body/header — helper `set_global_owner_context()` nie przyjmuje argumentu;
  * zaufany kod backendu (`TenantRLSMiddleware` dla sesji, `MFAEnforcingJWTAuthentication` dla JWT) ustawia GUC wyłącznie na podstawie zweryfikowanej roli użytkownika z bazy;
  * rola z bezpośrednim dostępem SQL może samodzielnie wykonać `set_config('app.is_global_owner', 'true')` — ten wariant nie chroni przed przejęciem poświadczeń DB ani dowolnym SQL injection;
  * brak argumentu helpera Python jest zabezpieczeniem interfejsu aplikacji, a nie uprawnieniem DB;
  * rozdzielenie ról DB (np. dedykowany użytkownik administracyjny bez `BYPASSRLS` dla runtime) pozostaje późniejszym hardeningiem infrastruktury poza T11.
* Warunek polityki (wspólny dla `USING` i `WITH CHECK`):
  * `app.is_global_owner = 'true'` — globalny dostęp;
  * LUB (`app.tenant_id` niepuste AND `tenant_id IS NOT NULL` AND `tenant_id = app.tenant_id::uuid`).
* Lifecycle: `clear_all_context()` na początku każdego requestu; ustawienie kontekstu przez `TenantRLSMiddleware` (session) lub `MFAEnforcingJWTAuthentication` (JWT); `clear_all_context()` w `finally` po każdym requeście niezależnie od wyniku.
* Rola runtime: `current_user` zwrócony przez `DATABASE_URL` (produkcja Railway `4velo_user`, CI `fourvelo_ci`); nie jest tworzona przez T11.
* Brak tworzenia / modyfikacji / usuwania jakiejkolwiek roli PostgreSQL przez T11 — migracje, helpery, middleware, auth class, fixture.

### Tabela pięciu chronionych tabel

| Tabela | Źródło tenanta | USING | WITH CHECK | FORCE |
|--------|----------------|-------|------------|-------|
| `activities_activity` | bezpośrednie `tenant_id` | global-owner LUB (`app.tenant_id` set AND `tenant_id IS NOT NULL` AND `tenant_id = app.tenant_id`) | j.w. | yes |
| `activities_poi` | bezpośrednie `tenant_id` | j.w. | j.w. | yes |
| `activities_voucher` | via `activities_poi.tenant_id` | global-owner LUB (`app.tenant_id` set AND EXISTS na `activities_poi` o tym `tenant_id`) | j.w. (target POI) | yes |
| `users_department` | bezpośrednie `tenant_id` | global-owner LUB (`app.tenant_id` set AND `tenant_id IS NOT NULL` AND `tenant_id = app.tenant_id`) | j.w. | yes |
| `users_userdepartment` | via `users_department.tenant_id` | global-owner LUB (`app.tenant_id` set AND EXISTS na `users_department` o tym `tenant_id`) | j.w. (target department) | yes |

### Acceptance criteria

* `python -m pytest backend/test_rls.py -v` zielony na PostgreSQL/PostGIS (CI); FAILuje (nie pomija) na SQLite lub gdy `current_user` ma SUPERUSER / BYPASSRLS.
* Wszystkie pięć tabel ma `ENABLE` + `FORCE ROW LEVEL SECURITY` oraz politykę `fourvelo_tenant_isolation TO PUBLIC` z jawnym `USING` i `WITH CHECK`, w których `app.tenant_id` i `app.is_global_owner` są sprawdzane.
* `app.is_global_owner` jest porównywane z literalnym `'true'`; każda inna wartość fail-closed.
* Brak `fourvelo_app`, `fourvelo_admin`, `sport_app` w nowym kodzie, migracjach T11, helperach, middleware, CI. Legacy `sport_app`, `sportuser`, `sportpass`, `sport.current_tenant_id` nie pojawiają się w nowej implementacji (mogą występować wyłącznie w historycznych migracjach sprzed T11).
* Brak `CREATE ROLE` / `ALTER ROLE` / `DROP ROLE` / `GRANT <role> TO <role>` / wymogu `CREATEROLE` w nowych migracjach i helperach.
* Lifecycle: A→B→brak, A→global→brak, finally cleanup po wyjątku i rollbacku; `SKIP_PATHS` nie dziedziczą kontekstu; JWT (`MFAEnforcingJWTAuthentication`) i session authentication (`TenantRLSMiddleware`) ustawiają poprawny kontekst dla tego samego `request.user`.
* GLOBAL_OWNER widzi wszystkie wiersze z 5 tabel; zwykły tenant nie może uzyskać globalnego zakresu przez parametry requestu; brak uwierzytelnienia nie ustawia flagi globalnej; po requeście GLOBAL_OWNER oba GUC są puste.
* Detekcja negatywna: brak FORCE RLS, polityka niezwiązana z PUBLIC, polityka bez `app.tenant_id` lub `app.is_global_owner`, polityka porównująca flagę globalną z czymś innym niż literal `'true'` → twardy FAIL.
* Reverse SQL odtwarza historyczne polityki `tenant_isolation TO PUBLIC`, wyłącza FORCE (zgodnie ze stanem sprzed T11), nie wykonuje REVOKE, nie odwołuje się do `fourvelo_app` / `fourvelo_admin` / `sport_app`. Po reverse: `relrowsecurity=true`, obecna historyczna polityka, brak polityk T11, brak zależności od `fourvelo_app`. Ponowny forward działa bez błędów.
* Regresja T10: `users/test_department_tenant_scope.py`, `activities/test_moderation_tenant_scope.py`, `activities/test_heatmap_tenant_scope.py` nadal zielone.
* `scripts/test_ci_workflow_contract.py` zielony (stare + nowe klasy T11), w tym asercje: brak `run_pytest.py` w kroku T11, brak `pip install` w kroku T11, brak legacy `sport_user/sport_pass/sport_test` w jobie backend, obecność `fourvelo_ci` w postgres service.
* `python manage.py makemigrations --check --dry-run` czyste.
* Migracje od zera → `migrate` → `migrate <0022 zero>` → `migrate` (forward) → reverse T11 → forward T11 bez błędów.

### Validation commands

* `cd backend && python -m pytest test_rls.py -v` (PostgreSQL/PostGIS — krok CI uruchamia pytest bezpośrednio, z pominięciem `run_pytest.py`, który wymusza SQLite)
* `cd backend && python -m pytest users/test_department_tenant_scope.py activities/test_moderation_tenant_scope.py activities/test_heatmap_tenant_scope.py -q` (regresja T10; na CI ten sam krok `P1 admin pytest` co dla T10)
* `cd backend && python -m ruff check core/rls.py core/middleware.py users/jwt_auth.py test_rls.py activities/migrations/0036_canonical_fourvelo_rls.py users/migrations/0022_canonical_fourvelo_rls.py`
* `cd backend && python -m ruff format --check core/rls.py core/middleware.py users/jwt_auth.py test_rls.py activities/migrations/0036_canonical_fourvelo_rls.py users/migrations/0022_canonical_fourvelo_rls.py`
* `python -m pytest scripts/test_ci_workflow_contract.py -q` (T11 + wcześniejsze kontrakty)
* `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))"`
* `python scripts/check_docs_links.py`
* `cd backend && python manage.py makemigrations --check --dry-run`
* `git diff --check`

### Risks

* `users_user` i `users_department` są w tej samej aplikacji Django; `users_user` ma FK do `users.Tenant` o nazwie `tenant` (kolumna `tenant_id`). Migracja T11 wykorzystuje to bez zmian modeli.
* W CI service `postgis/postgis:15-3.3` tworzy `POSTGRES_USER` jako superuser; T11 wymaga, by behavioral testy były wykonywane jako ograniczona rola testowa (`fourvelo_rls_test` z NOSUPERUSER / NOBYPASSRLS / NOLOGIN). Fixture `_rls_test_role_setup` tworzy ją session-scoped i usuwa w teardown. Jeśli runtime w CI jest superuserem, behavioral testy działają poprawnie dzięki `SET LOCAL ROLE fourvelo_rls_test` w każdym asercjach; metadata testy sprawdzają `current_user` bezpośrednio.
* Wyłączenie `app.tenant_id` w workersach Celery i management commands wymaga follow-up; T11 nie przebudowuje tych ścieżek — RLS działa tylko wtedy, gdy middleware lub auth class ustawi kontekst. Workers i management commands muszą jawnie wywołać `tenant_context()` / `global_owner_context()` (follow-up poza T11).
* `users_user` (User) nie jest objęty T11 — to poza pięcioma tabelami.
* Legacy `sport_app` rola może pozostać w bazach, które nie miały migracji `0008`. T11 nie tworzy ani nie usuwa tej roli; opisany follow-up w raporcie końcowym.
* `test_rls.py` wymaga PostGIS (ST_GeomFromText) — CI dostarcza `postgis/postgis:15-3.3`. Lokalne uruchomienie bez PostGIS → test FAILuje (wymagane przez `pytest.fail`).
* Planowany hardening infrastruktury (poza T11): rozdzielenie ról migracyjnej / runtime / administracyjnej, ewentualne audytowe `SET ROLE` dla `GLOBAL_OWNER`, dedykowany `DATABASE_URL_ADMIN`. Decyzja właściciela po pierwszej walidacji w home lab.

### Rollback

Pojedynczy revert squash merge'a PR T11 przywraca stan sprzed transzy. Migracje T11 mają bezpieczne `reverse_sql` (drop polityk T11, recreate historycznych polityk, `NO FORCE ROW LEVEL SECURITY`). Kroki:

1. `python manage.py migrate activities 0035_garmin_simulator_credential`
2. `python manage.py migrate users 0021_userpushtoken`
3. Legacy `sport_app` (jeśli obecny w bazie) pozostaje nietknięty.
4. Po reverse (dokładny stan sprzed T11):
   * `relrowsecurity=true` dla pięciu tabel (RLS włączony),
   * `relforcerowsecurity=false` (FORCE usunięte przez `NO FORCE ROW LEVEL SECURITY`),
   * brak polityk T11 (`fourvelo_tenant_isolation` usunięte),
   * aktywne polityki historyczne:
     * `activities_activity`, `activities_poi`, `activities_voucher`: `tenant_isolation TO sport_app` (z migracji `0008`),
     * `users_department`: `department_tenant_isolation TO PUBLIC` (z migracji `0014`),
     * `users_userdepartment`: `userdepartment_tenant_isolation TO PUBLIC` (z migracji `0014`),
   * brak zależności od `fourvelo_app` / `fourvelo_admin`.
5. Reverse NIE wykonuje `DISABLE ROW LEVEL SECURITY` (pozostawiałoby tabele bez RLS — szerszy dostęp niż przed T11) ani nie wykonuje `REVOKE` dla nieistniejących ról T11.

### Dependencies

* T10 (DONE, PR #72, squash `ed261c8418d1d16127f0c35d169aaecbfe33dc84`).
* T22 (`Aggregate CI gate`, DONE).
* Istniejąca usługa PostgreSQL/PostGIS w jobie `backend` (`postgis/postgis:15-3.3`).

### Branch / commit

* Branch: `security/rls-real-enforcement`
* Commit 1: `docs: activate T11 RLS real enforcement`
* Commit 2: `security: enforce tenant isolation with PostgreSQL RLS`

### Follow-up (poza T11)

* Integracja `tenant_context()` / `global_owner_context()` w workersach Celery i management commands. T11 nie przebudowuje tych ścieżek.
* Rozszerzenie RLS na `users_user`, `core_platformnotice` i inne tabele tenantowe (poza zakresem małej transzy T11).
* Planowany hardening infrastruktury: rozdzielenie ról PostgreSQL — migracyjna (tworzy tabele), runtime (właściciel tabeli, `DATABASE_URL`), administracyjna (`fourvelo_admin` z `BYPASSRLS` dla `GLOBAL_OWNER`). Decyzja właściciela po pierwszej walidacji T11 w home lab.
* Aktualizacja dokumentacji operacyjnej (`docs/en/INSTALLATION.md`, `docs/pl/INSTALLATION.md`, `docs/en/TROUBLESHOOTING.md`, `docs/pl/TROUBLESHOOTING.md`) o usunięcie `python apply_rls.py` — follow-up po merge T11.
* Automatyczne usunięcie legacy roli `sport_app` (jeśli kiedykolwiek istniała w bazie) — follow-up po decyzji właściciela.

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

Aktywny cel i następne zadanie: [plan częściowego takeoveru i pilotażu](PARTIAL_TAKEOVER_PILOT_PLAN.md).

Nie realizuj automatycznie T00–T59 ani historycznej kolejności powyżej. Wybieraj małe zadanie według blokerów krytycznej ścieżki pilotażu; odłożenie transzy nie oznacza DONE. Zachowaj istniejące kontrakty bezpieczeństwa i bramki CI.

Następny krok: P1 — przygotowanie punktu odniesienia, istniejący home lab i ścieżka jazdy na Androidzie. Brak dostępu do środowiska raportuj jako BLOCKED, nie PASS.

Zakazane bez osobnego zlecenia: wdrożenia i migracje produkcyjne, seed/wipe, rotacja sekretów, płatne usługi, merge, force-push oraz osłabianie testów i zabezpieczeń. Nie modyfikuj chronionych lokalnych plików ani niepowiązanego kodu.

Stosuj AGENTS.md: zakres jednego zadania, właściwe testy, kontrola diffu, prawdziwe wyniki i raport przed kolejnym zadaniem.
