# 4VELO — mapa ryzyka i odpowiedzialności technicznej

## 1. Zakres i metoda

- **Data:** 2026-09-09
- **Gałąź:** `audit/risk-and-ownership-map` (utworzona z `main`)
- **Analizowane źródła:** kod źródłowy (`backend/`, `telemetry/`, `admin/`, `mobile/`, `packages/`, `scripts/`, `infrastructure/`), testy, konfiguracja (`settings.py`, `railway.json`, `docker-compose*.yml`, `infrastructure/k8s/`, `.github/workflows/`), dokumentacja (`README.md`, `CONTRIBUTING.md`, `docs/PROJECT_TAKEOVER.md`, `docs/reports/REPOSITORY_MAP.md`, `docs/reports/QUALITY_COMMAND_MATRIX.md`, `reports/*`).
- **Ograniczenia środowiska:** Docker/Podman, PostGIS, Redis, emulator, Expo EAS i narzędzia `ruff`/`mypy`/`pytest` są niedostępne; nie uruchamiano usług, migracji, seedowania, zadań Celery ani serwerów. Analiza jest czysto statyczna (odczyt plików, `git grep`, `git ls-files`).
- **Rozróżnienie typów dowodu:** `CODE` (mechanizm istnieje w implementacji — nie dowodzi skuteczności) · `TEST` (zachowanie pokryte testem) · `CI` (kontrola w aktywnym workflow) · `DOCS ONLY` (tylko dokumentacja) · `ENVIRONMENT REQUIRED` (wymaga działającego środowiska/usługi) · `UNKNOWN` (brak dowodów). Istnienie klasy/funkcji/pliku **nie** jest dowodem poprawnego działania.

## 2. Skala ocen

| Poziom | Znaczenie |
|---|---|
| P0 | Potwierdzona lub bardzo prawdopodobna sytuacja mogąca prowadzić do utraty danych, przejęcia konta, ujawnienia sekretów lub danych między tenantami, nieautoryzowanych płatności albo niemożliwego bezpiecznego wdrożenia produkcyjnego. |
| P1 | Poważne ryzyko bezpieczeństwa, integralności, prywatności, dostępności lub operacji wymagające rozwiązania przed release candidate. |
| P2 | Istotny dług techniczny, brak testów lub procedur utrudniający utrzymanie, bez potwierdzonego natychmiastowego zagrożenia. |
| P3 | Usprawnienie, porządek lub brak o niskim wpływie. |

Statusy dowodu: `CODE`, `TEST`, `CI`, `DOCS ONLY`, `ENVIRONMENT REQUIRED`, `UNKNOWN` (możliwe kombinacje rozdzielone przecinkiem).

## 3. Główna mapa ryzyka i odpowiedzialności

| Obszar | Moduły i ścieżki | Dane wejściowe | Dane wyjściowe | Usługi zewnętrzne | Istniejące zabezpieczenia | Istniejące testy | Brakujące testy lub dowody | Ryzyko P0–P3 | Status dowodu | Odpowiedzialna rola | Decyzja właściciela |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dane osobowe i prywatność | `backend/users/models.py`, `backend/users/serializers.py`, `backend/activities/services.py` (PrivacyService), `backend/activities/models.py` (PrivacyZone) | email, username, profil, strefy prywatności | profile, exporty, audyt | — | Maskowanie GPS w strefach prywatności (PrivacyService.mask_track), pola użytkownika | `test_poi_sponsor_profile.py`, testy serializatorów | Brak testu maskowania prywatności end-to-end; brak polityki minimalizacji danych | P2 | CODE | Data Protection | Zatwierdzić zakres danych osobowych i politykę minimalizacji |
| Lokalizacja oraz dane GPS | `telemetry/` (ingest, `db.py`), `backend/activities/services.py`, `backend/activities/live_map_timescale.py`, `backend/activities/migrations/0015_live_position_events.py` | pozycje GPS (lat/lon/speed), strefy prywatności | `gps_points`, `live_position_events`, mapa live | Traccar, BRouter | Maskowanie stref prywatności; polityka retencji 30 dni na `live_position_events` | `test_gps_signal_processing.py`, testy ingestu | Brak jednolitej retencji dla `gps_points`; brak testu retencji/maskowania GPS | P2 | CODE | Data Protection | Określić retencję surowych danych GPS |
| Uwierzytelnianie, JWT, MFA i sesje | `backend/core/settings.py`, `backend/users/mfa.py`, `backend/users/mfa_views.py`, `backend/users/test_jwt_mfa.py`, `backend/core/google_auth.py`, `backend/core/social_auth.py` | login/password, TOTP, OAuth (Google/Facebook) | JWT (access 60 min, refresh 30 dni), sesje | Google OAuth, Facebook | SimpleJWT (rotacja + blacklist), TOTP MFA (RFC 6238), throttle login 5/min | `test_jwt_mfa.py`, `test_mfa.py` | `test_jwt_mfa.py` deklaruje „MFA gate deferred for GLOBAL_OWNER (P2 Auth, end of roadmap)” — brak dowodu wymuszania MFA przy logowaniu uprzywilejowanych ról | P1 | CODE, TEST | Backend Lead | Wymusić MFA dla ról uprzywilejowanych przed RC |
| Role, uprawnienia i izolacja tenantów | `backend/users/rbac_models.py`, `backend/users/models.py` (get_permissions/has_perm), `backend/users/permissions.py`, `backend/core/rls.py`, `backend/core/middleware.py`, `backend/apply_rls.py` | role, uprawnienia, tenant_id | decyzje dostępu, zapytania filtrowane | — | RBAC (Permission/Role/UserRole), TenantRLSMiddleware, RLS | `test_rbac.py`, `test_middleware.py`, `test_rls.py`, CI `audit:rbac` | RLS obejmuje tylko 3 tabele (`activities_activity`, `activities_poi`, `activities_voucher`); izolacja pozostałych tabel tenantowych opiera się na filtrowaniu aplikacyjnym — niezweryfikowana | P1 | CODE, TEST, CI, ENVIRONMENT REQUIRED | Backend Lead | Potwierdzić pełną izolację tenantów (rozszerzenie RLS lub audyt ORM) |
| Impersonation i logi audytowe | `backend/core/middleware.py` (ImpersonationAuditMiddleware), `backend/users/models.py` (AuditLog), `backend/users/admin.py` | żądania z tokenem impersonacji | wpisy AuditLog (impersonator, target, tenant) | — | ImpersonationAuditMiddleware loguje mutujące żądania, permission `users.impersonate` | `test_middleware.py` (TestImpersonationAuditMiddleware) | Brak testu, że log nie może być podmieniony/skasowany przez impersonatora | P2 | CODE, TEST | Backend Lead | — |
| Eksport oraz usuwanie danych użytkownika | `backend/users/export_models.py`, `export_tasks.py`, `export_views.py`, `backend/activities/admin_views.py` (ExportDataView), `backend/activities/gpx_export.py` | user_id, zasoby | ZIP exportu (GPX/JSON), presigned URL | S3/presigned storage | Śledzenie zadań eksportu (UserDataExport), UserDeleteView z logiem audytu | `test_export.py`, `test_admin.py` (TestUserDelete), `test_gpx_export.py` | Brak potwierdzonego usuwania danych GPS/telemetrycznych użytkownika (erasure) | P2 | CODE, TEST | Data Protection | Określić proces „prawo do bycia zapomnianym” dla GPS/telemetrii |
| Retencja danych | `backend/activities/migrations/0015_live_position_events.py`, `backend/activities/management/commands/check_disk_guard.py`, `telemetry/ingest_queue.py`, `telemetry/config.py` | dane live/GPS, zadania | polityki retencji (30 dni live events), kompresja 7 dni | TimescaleDB | add_retention_policy (30 dni), compression policy (7 dni), SCALE_SIM_ACTIVITY_RETENTION_DAYS, DEDUPE_TTL | `test_scale_disk_guard.py`, `test_scale_disk_monitor.py` | Brak jednolitej polityki retencji dla wszystkich tabel danych osobowych | P2 | CODE, TEST | Operations | Ustalić macierz retencji per typ danych |
| Płatności i Stripe | `backend/activities/payments.py`, `payments_views.py`, `backend/rewards/stripe_service.py` | webhook Stripe, price_id, user_id | sesje checkout, status premium | Stripe | Weryfikacja podpisu webhook (construct_event), odrzucenie bez STRIPE_WEBHOOK_SECRET, CSRF exempt dla webhook | `test_payments.py` | Obsługa tylko `checkout.session.completed` — brak downgrade/cancel/failure; brak testu idempotencji webhook | P2 | CODE, TEST | Finance/Payments | Zatwierdzić pełny cykl życia subskrypcji |
| Strava i Garmin | `backend/activities/wearables.py`, `garmin_upload.py`, `garmin_mailtm.py` | OAuth2 tokens, aktywności | synchronizacja/upload aktywności | Strava, Garmin | Szyfrowanie tokenów OAuth (cryptography), `WearableIntegration` | `test_wearables.py`, `test_garmin_simulator.py` | Brak timeoutów na części wywołań HTTP (PHASE_A B113) — ryzyko DoS; brak testu odświeżania tokena | P2 | CODE, TEST | Backend Lead | — |
| Email, push, Firebase i Matrix | `backend/core/email_service.py`, `backend/users/notifications.py`, `backend/users/push_tasks.py`, `backend/core/matrix_provisioner.py`, `matrix_e2ee_verify.py` | użytkownicy, treści powiadomień | email, push, zdarzenia Matrix | SendGrid, Firebase (FCM), Matrix | Kolejki Celery `notifications`, weryfikacja e2ee Matrix | `core/test_email.py` | Brak testów push/Firebase i Matrix provisioning | P2 | CODE, TEST | Backend Lead | — |
| LLM oraz OpenAI-compatible API | `backend/core/llm_proxy.py`, `mobile/src/services/AvatarTrainerService.ts` | wiadomości użytkownika, model, max_tokens | odpowiedzi LLM | OpenAI / API kompatybilne | Klucz serwerowy (nie trafia do klienta), timeout 5 s, fallback 502/504 | brak testu llm_proxy | Brak limitu rate/cost (klient steruje modelem i max_tokens); prompt injection nieprzebadany | P2 | CODE | Backend Lead | Ustalić limity kosztów i modele dozwolone |
| Telemetry ingest, kolejki ingestu i WebSocket | `telemetry/main.py`, `telemetry/ingest_service.py`, `telemetry/ingest_queue.py`, `telemetry/ingest_guard.py`, `telemetry/ingest_auth.py`, `telemetry/ws_manager.py`, `telemetry/privacy.py` | pakiety GPS (HTTP/WS), JWT (opcjonalnie) | zapis do PG, broadcast WebSocket | Redis | Guard limitu ingestu (fail-open), Redis Stream z DLQ, opcjonalny JWT | `test_ingest_guard*.py`, `test_ingest_dedupe.py`, `test_ingest_queue.py`, `test_ingest_jwt.py` | JWT przy ingeście jest OPCJONALNY (`TELEMETRY_INGEST_JWT_REQUIRED` domyślnie off) — domyślnie ingest bez uwierzytelnienia; CORS `*` | P1 | CODE, TEST, ENVIRONMENT REQUIRED | Backend Lead | Włączyć wymóg JWT dla ingestu produkcyjnego |
| Redis, Celery i zadania okresowe | `backend/core/settings.py`, `backend/core/celery.py`, `backend/core/redis_cluster.py`, `backend/core/fake_redis.py` | zadania, harmonogram beat | kolejki critical/default/notifications/simulation/routing | Redis | Routing kolejek, beat schedule (ML retrain, MV refresh, disk monitor, timescale snapshot), ack late | `test_simulator_backpressure.py`, `test_scale*.py` | Brak testów niezawodności brokera w warunkach awarii Redis (fail-over) | P2 | CODE, TEST | Operations | — |
| Anti-cheat oraz modele ML | `backend/activities/ml_anomaly.py`, `ml_retrain.py`, `signal_processing.py`, `viterbi_matching.py`, `gpx_forensics.py` | ślady GPS, prędkości | flagi anomalii, wyniki walidacji | BRouter | Warstwy: kinematyka, V-max, topologia BRouter, HMM Viterbi | `test_ml_anomaly.py`, `test_gps_signal_processing.py`, `test_gpx_forensics.py` | pickle.load modelu ML (zaufane źródło — LOW wg PHASE_A); brak testu adversarial | P2 | CODE, TEST | Backend Lead | — |
| Symulatory, Garmin Simulator, wipe i demo seed | `backend/activities/simulator_*.py`, `garmin_simulator.py`, `wipe_tasks.py`, `wipe_state.py`, `backend/seed_data.py`, `docker-entrypoint.sh` | parametry symulacji, seed demo | dane symulowane, wipe | BRouter, OSRM | Seed demo opt-in (`RUN_DEMO_SEED` domyślnie 0), wipe gated przez env/komendy | `test_simulator_*.py`, `test_wipe_flow.py`, `test_wipe_state.py`, `test_garmin_simulator.py` | Brak potwierdzenia, że wipe nie może zostać wywołany w prod bez wyraźnej zgody | P2 | CODE, TEST | Operations | Zatwierdzić zasady używania symulatorów i danych demo |
| PostgreSQL, PostGIS, TimescaleDB i Citus | `docker-compose.yml`, `docker-compose.scale.yml`, `backend/core/citus.py`, `backend/activities/live_map_timescale.py` | dane domenowe, GIS, szeregi czasowe | hypertable, shards | PostgreSQL/TimescaleDB | PostGIS, TimescaleDB hypertable, Citus sharding (manualny/opt-in) | — | Brak testów sharding Citus i zachowania hypertable w CI | P2 | CODE, DOCS ONLY | Operations | Zatwierdzić strategię skalowania (Citus vs Timescale) |
| Migracje baz danych | `backend/docker-entrypoint.sh`, `backend/*/migrations/`, `.github/workflows/ci.yml` | kod migracji | zmiany schematu | PostgreSQL | Migracje uruchamiane przy starcie (`manage.py migrate --no-input`) | CI: `manage.py migrate` | Auto-migracja przy każdym starcie kontenera — ryzyko równoległego startu/współbieżnych migracji | P1 | CODE, CI | Operations | Wprowadzić dedykowany job migracji przed skalowaniem |
| Backup i odtwarzanie | `docs/runbooks/db_recovery.md`, `docs/pl/runbooks/db_recovery.md` | — | — | PostgreSQL | Brak kodu backupu/restore; tylko runbook | — | Brak automatycznego backupu i potwierdzonego restore; brak RPO/RTO | P1 | DOCS ONLY, ENVIRONMENT REQUIRED | Operations | Ustalić RPO/RTO i procedurę backupu + test restore |
| Railway, Docker Compose i Kubernetes | `*/railway.json`, `docker-compose*.yml`, `infrastructure/k8s/`, `skaffold.yaml` | konfiguracja usług | deployment | Railway, Kubernetes | Osobne konfiguracje per usługa; CI docker-publish, k8s-release-gate | — | Dwa równoległe modele wdrożenia (Railway + K8s) bez wskazania głównego | P2 | CODE, CI, ENVIRONMENT REQUIRED | Operations | Wybrać jeden model wdrożenia produkcyjnego |
| Sekrety, klucze oraz konfiguracja środowiskowa | `backend/railway.json`, `.env.example`, `celery-worker*/railway.json`, `infrastructure/k8s/config/app-secrets.template.yaml` | zmienne środowiskowe | konfiguracja usług | — | Placeholdery w `.env.example`; sekrety w szablonie K8s | `audit:env`, `audit:secrets` (CI) | `backend/railway.json` zawiera jawnie zapisaną, nieplaceholderową wartość `SECRET_KEY` (sekret w śledzonym pliku i historii git) | P1 | CODE, CI, ENVIRONMENT REQUIRED | Security | Rotacja kluczy i przeniesienie sekretów poza repo |
| Logowanie, monitoring, alerty i Sentry | `backend/core/sentry.py`, `backend/core/settings.py`, `infrastructure/observability/`, `backend/activities/analytics.py` | zdarzenia, błędy | logi, metryki, alerty | Sentry, Prometheus, Grafana | Sentry (Django+Celery), stack Prometheus/Grafana/eksportery, analityka | — | Brak potwierdzonej konfiguracji alertów produkcyjnych; monitoring częściowo DOCS | P2 | CODE, DOCS ONLY | Operations | Zatwierdzić właściciela incydentów i alertów |
| API oraz generowane kontrakty OpenAPI | `backend/core/settings.py` (drf-spectacular), `scripts/export_openapi.py`, `scripts/check_openapi_drift.py`, `packages/api-client/` | schemat API | openapi.json, klient Orval | — | drf-spectacular, sprawdzanie dryftu OpenAPI | CI: `check_openapi_drift.py`, `api:codegen:check` | Dryft API wykrywany tylko dla ścieżek krytycznych | P2 | CODE, CI | Backend Lead | — |
| Aplikacja mobilna i przechowywanie tokenów | `mobile/src/services/authTokenStorage.ts`, `apiClient.ts`, `apiRetry.ts` | tokeny access/refresh | zapis w Keychain/Keystore | Expo EAS, Firebase | expo-secure-store, migracja legacy MMKV | `authTokenStorage.test.ts`, `apiClient.refresh.test.ts` | In-memory fallback (web/testy) przechowuje tokeny poza bezpiecznym magazynem | P3 | CODE, TEST | Mobile Lead | — |
| Panel administracyjny | `admin/src/`, `admin/src/core/guards/PermissionGuard.tsx`, `admin/src/modules/*` | dane admin, role | UI admin | backend API | Guardy ról (PermissionGuard), i18n, RBAC | `admin` vitest (39 plików), E2E (Playwright) | Lokalnie `admin build` FAIL (zależność `@tabler/icons-react`) — nie jest potwierdzoną regresją produktu; wymaga ponowienia w czystym env | P2 | CODE, TEST | Frontend/Admin Lead | — |
| Zależności oraz alerty bezpieczeństwa | `backend/requirements.txt`, `admin/package.json`, `mobile/package.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `SECURITY.md` | deklaracje zależności | raporty skanów | — | pip-audit, pnpm audit, Trivy, license check (CI) | CI security job | Lokalnie `admin build` FAIL z `@tabler/icons-react`; brak pełnego czystego instalacji w audycie | P2 | CODE, CI | Security | Potwierdzić zielony frozen install na Node 20 |

### Podsumowanie głównej mapy

| Poziom | Liczba |
|---|---|
| P0 | 0 |
| P1 | 6 |
| P2 | 18 |
| P3 | 1 |
| Razem | 25 |

| Status dowodu | Liczba wystąpień |
|---|---|
| CODE | 24 |
| TEST | 14 |
| CI | 6 |
| DOCS ONLY | 3 |
| ENVIRONMENT REQUIRED | 5 |
| UNKNOWN | 0 |

## 4. Rejestr P0 i P1

Nie zidentyfikowano potwierdzonego P0 w analizie statycznej.

| ID | Poziom | Obszar | Status | Ścieżki dowodowe | Możliwy wpływ | Minimalne kryterium zamknięcia | Odpowiedzialna rola |
|---|---|---|---|---|---|---|---|
| RISK-001 | P1 | Sekrety i konfiguracja | CONFIRMED (committed); REQUIRES VERIFICATION (produkcyjne użycie) | `backend/railway.json` (pole `SECRET_KEY` z nieplaceholderową wartością) | Przejęcie sesji/JWT, fałszowanie podpisów, gdy klucz jest używany w prod | Rotacja klucza, przeniesienie do zmiennej środowiskowej, usunięcie z historii git; potwierdzenie, że prod używa innego klucza | Security |
| RISK-002 | P1 | Telemetry ingest | REQUIRES VERIFICATION | `telemetry/ingest_auth.py` (JWT opcjonalny, `TELEMETRY_INGEST_JWT_REQUIRED` domyślnie off), `telemetry/main.py` (CORS `*`), `telemetry/ingest_guard.py` (fail-open) | Nieautoryzowany zapis danych GPS, zanieczyszczenie danych live | Włączenie `TELEMETRY_INGEST_JWT_REQUIRED=1` w prod + test end-to-end odrzucenia bez tokena | Backend Lead |
| RISK-003 | P1 | Izolacja tenantów | REQUIRES VERIFICATION | `backend/core/rls.py` (RLS tylko dla 3 tabel), `backend/core/middleware.py` (TenantRLSMiddleware) | Dostęp między tenantami do danych nieobjętych RLS | Audyt wszystkich modeli tenantowych + rozszerzenie RLS lub dowód filtrowania w ORM + test cross-tenant | Backend Lead |
| RISK-004 | P1 | Migracje | CONFIRMED | `backend/docker-entrypoint.sh` (`manage.py migrate --no-input` przy każdym starcie) | Błędy przy równoległym starcie wielu replik, niekontrolowana zmiana schematu | Dedykowany job migracji uruchamiany jednorazowo przed wdrożeniem | Operations |
| RISK-005 | P1 | Backup i odtwarzanie | REQUIRES VERIFICATION | `docs/runbooks/db_recovery.md`, `docs/pl/runbooks/db_recovery.md` (brak kodu backupu) | Trwała utrata danych bez możliwości odtworzenia | Zautomatyzowany backup + udokumentowany, przetestowany restore + zdefiniowane RPO/RTO | Operations |
| RISK-006 | P1 | Uwierzytelnianie i MFA | REQUIRES VERIFICATION | `backend/users/test_jwt_mfa.py` („MFA gate deferred for GLOBAL_OWNER (P2 Auth, end of roadmap)”), `backend/users/mfa_views.py` | Przejęcie kont uprzywilejowanych samym hasłem | Wymuszenie MFA przy logowaniu ról uprzywilejowanych + test blokady logowania bez MFA | Backend Lead |

## 5. Decyzje wymagane od właściciela

Kod nie rozstrzyga poniższych kwestii:

1. **Główny model wdrożenia:** Railway czy Kubernetes (oba współistnieją w `railway.json` i `infrastructure/k8s/`).
2. **Retencja danych GPS:** brak jednolitej polityki dla `gps_points` i innych danych osobowych (tylko 30 dni dla `live_position_events`).
3. **Własność kont usług zewnętrznych:** Railway, Expo EAS, Firebase, Stripe, SendGrid, Strava, Garmin, Matrix, Sentry, Google — rotacja i inwentaryzacja właścicieli.
4. **Zakres release candidate:** które funkcje eksperymentalne (symulatory, AI coaching, Citus, K8s) wchodzą do RC.
5. **Wymagane RPO i RTO:** dla backupu/odtwarzania.
6. **Zasady używania symulatorów i danych demonstracyjnych:** kiedy `RUN_DEMO_SEED`, wipe i symulatory są dopuszczalne.
7. **Status funkcji eksperymentalnych:** MFA (wdrożone, nie wymuszone), Citus sharding, K8s.
8. **Odpowiedzialność za incydenty i monitoring:** właściciel alertów, eskalacji i on-call.

## 6. Weryfikacje wymagające środowiska

| Środowisko/usługa | Operacja do wykonania później | Oczekiwany dowód | Ryzyko wykonania | Wymagana zgoda właściciela |
|---|---|---|---|---|
| PostgreSQL/PostGIS + Redis (staging) | Uruchomienie backendu i testów (`run_pytest.py`, `manage.py test`) | Zielone testy na PostGIS, nie SQLite | Niskie (środowisko izolowane) | Tak |
| Środowisko produkcyjne (Railway) | Weryfikacja czy `backend/railway.json` SECRET_KEY jest faktycznie używany | Potwierdzenie rotacji i niezależności klucza prod | Wysokie (prod) | Tak |
| Telemetry + klient mobile | Test end-to-end ingestu z wymuszonym JWT | Odrzucenie żądania bez tokena | Niskie (staging) | Tak |
| Emulator Android + Maestro | Testy E2E mobile (`test:e2e`) | Zielone flows Maestro | Niskie | Nie |
| Backup produkcyjny + izolowane środowisko odtworzeniowe | Pobranie kontrolowanego backupu i odtworzenie wyłącznie w izolowanym środowisku; nigdy do aktywnej bazy produkcyjnej. | Potwierdzone odtworzenie + RPO/RTO | Wysokie (prod) | Tak |
| Stripe (test mode) | Pełny cykl subskrypcji (create/cancel/failure webhook) | Poprawny downgrade/cancel | Średnie (konto testowe) | Tak |
| Strava/Garmin (test mode) | Flow OAuth2 + timeouty | Brak blokady wątku, poprawne odświeżanie | Średnie | Tak |

## 7. Rekomendowana kolejność dalszej weryfikacji

1. P0 — brak potwierdzonego P0; zweryfikować RISK-001 (klucz) jako najpilniejszy.
2. P1 — RISK-001..RISK-006 w kolejności: sekrety, izolacja tenantów, ingest auth, MFA, migracje, backup.
3. Krytyczna ścieżka użytkownika (logowanie → aktywność → telemetria → moderacja admin).
4. Backup i restore (zdefiniować RPO/RTO, przetestować odtworzenie).
5. Izolacja tenantów (rozszerzenie RLS + testy cross-tenant).
6. Sekrety i integracje (inwentaryzacja i rotacja kont zewnętrznych).
7. Infrastruktura (wybór Railway vs K8s, dedykowany job migracji).
8. P2 i P3 (retencja, limity LLM, timeouty wearables, pełny cykl Stripe).

## 8. Ograniczenia raportu

Niniejszy dokument jest **analizą statyczną** wykonaną bez uruchamiania usług, baz danych ani zewnętrznych integracji. Nie stanowi certyfikacji bezpieczeństwa, audytu penetracyjnego ani potwierdzenia produkcyjnej gotowości. Lokalne wyniki `FAIL`/`BLOCKED` z `QUALITY_COMMAND_MATRIX.md` nie są traktowane jako potwierdzone regresje produktu; brak narzędzi/usług oznacza `ENVIRONMENT REQUIRED` lub brak dowodu. Wartości sekretów nie były odczytywane ani przytaczane.
