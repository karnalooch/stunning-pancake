# 4VELO Mobile Full Vision — Specyfikacja wdrożeniowa (Active)

## Cel

Ten dokument przekłada plan full vision mobile na kontrakty implementacyjne w repozytorium. Jest dokumentem wykonawczym SSOT dla przebudowy aplikacji mobilnej i uzupełnia ADR-y oraz specyfikacje produktowo-designowe.

## Snapshot wykonania (2026-06-14)

- Brama typów: `pnpm exec tsc --noEmit` jest zielona dla workspace mobile.
- Pakiet regresji: nawigacja, onboarding, kontrolki/status HUD, telemetry storage/export, trigger engine, polityka env social auth (targetowane suite przechodzą).
- Hardening runtime domknięty w kodzie:
  - release-safe polityka fallbacków env (`API`, `telemetry`, `social auth`) z fallbackiem tylko w `__DEV__`,
  - spójny kontrakt navigation/deep-link (`RideSummary` z opcjonalnym parametrem),
  - hardening status/edge-state dla Ride/Profile/Detail.
- Pozostałe blokery release są operacyjne, nie kodowe:
  - manualna device matrix QA (Android/iOS),
  - finalny cross-functional sign-off GO/NO-GO.

## Źródła kanoniczne (kolejność SSOT)

1. `docs/design/DESIGN_SYSTEM_MOBILE.md`
2. `docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md`
3. `docs/pl/DATA_RESILIENCE.md`
4. `docs/adr/012-mobile-performance-budgets.md`
5. `docs/pl/CONSTITUTION.md`

## Referencje hardeningu operacyjnego

- `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md`
- `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
- `docs/pl/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md`

## Rozjazdy dokumentacyjne do zamknięcia

- Zsynchronizować sekcje statusu między `docs/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md` i `docs/pl/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`.
- Utrzymać wyłącznie branding `4VELO` (bez alternatywnych nazw).
- Ujednolicić narrację migracji background trackingu w dokumentach operations.
- Aktualizować indeks ADR w `docs/pl/README.md` co najmniej do ADR 014.

## Docelowy kontrakt architektury (`mobile/src`)

- `app/`: shell aplikacji, orkiestracja lifecycle, bramki auth/startup.
- `navigation/`: parametry tras, deep linki, kontrakt tab/stack, nagłówki.
- `features/ride`: HUD, mapa, pola danych, lifecycle i edge states.
- `features/compete`: city hub, questy, leaderboard, kluby i segmenty.
- `features/explore`: mapa POI i wejścia do marketplace.
- `features/profile`: profil zawodnika, trendy, dziennik, ustawienia.
- `components/ui`: współdzielone prymitywy chrome, karty, stany empty/loading/error.
- `services/`: transport backend, retry, telemetry upload, persistence i adaptery integracyjne.
- `theme/` i `assets/`: tokeny wizualne i mapowania assetów runtime.
- `hooks/`: przekrojowe zachowania runtime (performance, motion, locale, theme).

## Kontrakt nawigacji

- Taby główne: `Ride`, `Compete`, `Explore`, `Profile`.
- Ukryty tab runtime: `Tracking` dla HUD aktywnej jazdy.
- Overlay/modal root stack: `Settings`, `RidePaused`, `RideSummary`, `GpsDiagnostics`.
- Ekrany domenowe w root stack: `TrainingLog`, `ActivityDetail`, `ExploreMap`, `Marketplace`, `Clubs`, `Segments`, `PerformanceTrends`, `GlobalLeaderboard`.
- Deep linki:
  - `fourvelo://ride/summary/:activityId`
  - `fourvelo://profile/activity/:activityId`
  - `fourvelo://explore/map`
  - `fourvelo://explore/marketplace`
  - `fourvelo://settings`

## Kontrakt domeny Ride (full vision)

- Lifecycle jazdy: start, pause, resume, stop, przejście do summary.
- Focus HUD z:
  - konfigurowalnymi layoutami pól i profilami jazdy,
  - warstwą mapy i markerem zawodnika,
  - paskiem statusu (`GPS`, `battery`, `clock`),
  - interakcją potwierdzenia STOP.
- Voice cues dla trybu eyes-free i zgodności z reduced motion.
- Trwałość telemetry:
  - MMKV buffer i outbox,
  - retry z backoff i obsługą `Retry-After`,
  - recovery przy starcie i recovery ręczne.
- Turn-by-turn etapowo:
  - faza 1: linia trasy + dystans do kolejnego manewru,
  - faza 2: pełne karty manewrów.

## Kontrakt domen engagement

- `Compete`: city wars, leaderboard, questy nearby, przejścia do klubów/segmentów.
- `Explore`: mapa POI i trasa marketplace.
- `Profile`: statystyki zawodnika, trendy, szczegóły aktywności, ranking globalny, ustawienia.
- Każda domena musi udostępniać:
  - stan loading,
  - stan empty,
  - stan offline,
  - recoverable error state.

## Kontrakt unifikacji design systemu

- Komponenty UI pochodzą wyłącznie z `components/ui`.
- Duplikaty legacy w `components/` pozostają tymczasowymi wrapperami i delegują do `components/ui`.
- Kolory pochodzą ze Stitch/Grand Prix tokenów przez `theme/*` (bez lokalnych, niespójnych palet).
- Ikony tab/chrome pochodzą z runtime registry `assets/*`.
- i18n mobile utrzymuje komplet kluczy równolegle w `strings.pl.ts` i `strings.en.ts`.

## Bramy niefunkcjonalne

- Performance:
  - cel HUD 60 FPS, budżet minimalny 55 FPS,
  - auto-degrade ciężkich efektów przy przekroczeniu budżetu.
- Security i privacy:
  - JWT w SecureStore,
  - brak sekretów w bundlu klienta,
  - zachowanie kontraktów privacy zones.
- Accessibility:
  - respektowanie reduced motion w warstwach animacji,
  - redundantne kodowanie statusów (kolor + ikona),
  - czytelny kontrast HUD dzień/noc.
- Observability:
  - crash capture i naruszenia budżetów performance wysyłane do analytics.

## Bramy testów i release

- Pokrycie unit/integration dla:
  - kontraktów nawigacji,
  - edge state lifecycle,
  - ścieżek retry/recovery.
- Smoke E2E Maestro:
  - auth,
  - lifecycle jazdy,
  - GPS recovery,
  - immersive theme.
- Gotowość release:
  - brak nierozwiązanych regresji P0 w ride/auth/sync,
  - zsynchronizowany status dokumentacji EN/PL dla zakresu mobile.
