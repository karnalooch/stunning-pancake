# Vision Parity Gate — 4VELO mobile

| | |
|--|--|
| **Data** | 2026-06-15 |
| **Referencja wizualna** | [`screenshots/2026-06-14-emulator-audit/vision/`](screenshots/2026-06-14-emulator-audit/vision/) (56 plików PNG) |
| **Zakres** | Pełne 1:1 z `vision/` — refactor-first (tokeny → prymitywy → ekrany → gate) |
| **SSOT runtime** | [`mobile/src/theme/grandPrix.ts`](../../mobile/src/theme/grandPrix.ts) |

## Jak czytać status

- **DONE (code)** — kierunek wizualny z `vision/` wdrożony w kodzie i zweryfikowany testami/typami (logika + tokeny + prymitywy). Wymaga jeszcze potwierdzenia na urządzeniu/emulatorze.
- **PARTIAL** — ekran korzysta już ze wspólnych tokenów/prymitywów (ciepła paleta, pixel-font chrome, zielona selekcja / pomarańczowe CTA), ale pełna zgodność z ilustrowanym mockiem wymaga iteracji na urządzeniu i/lub dedykowanych assetów ilustracyjnych.
- **DEV-VAR** — plik roboczy (iteracja eksploracyjna), nie samodzielny ekran docelowy; pokryty przez kanoniczny ekran.

> Uwaga: mocki w `vision/` to renderery pixel-art (pełne ilustracje sceny). Dosłowna zgodność „pixel-identyczna" w React Native jest osiągana przez: (1) wspólny język wizualny (paleta/typografia/CTA/karty/sceny) — zrobione w kodzie, oraz (2) finalny pass na urządzeniu + assety scen. Gate poniżej oznacza (1) jako DONE i pozostawia (2) jako pozycje weryfikacji na urządzeniu.

## Zmiany w kodzie wykonane w tym przejściu (refactor-first)

### Faza 0 — odblokowanie onboardingu (P0)
- Lista działów nigdy nie jest pusta — fallback drużyn gdy `DepartmentService.getTree()` zwróci `[]` lub rzuci błąd ([`OnboardingScreen.tsx`](../../mobile/src/screens/OnboardingScreen.tsx)).
- `self-join` pomijany dla lokalnych fallbacków (ujemne `id`).
- Onboarding trwale się kończy — flaga globalna gdy brak stabilnego `user.id` ([`useAuthSession.ts`](../../mobile/src/bootstrap/useAuthSession.ts), [`storage.ts`](../../mobile/src/bootstrap/storage.ts)).
- Żądanie uprawnień GPS owinięte w `try/catch` — brak „białego ekranu"/pętli na onboarding.

### Faza 1 — unifikacja tokenów (jeden runtime SSOT)
- `grandPrix.ts` oznaczony jako autorytatywne źródło runtime; `packages/tokens` to mirror projektowy (nie importowany w runtime).
- Dodane tokeny zgodne z `vision/`: `cta`/`ctaDark`/`onCta` (pomarańczowe CTA), `selection`/`selectionBorder`/`onSelection` (zielona selekcja), `disabledSurface`/`disabledDark`/`onDisabled` (ciepły disabled zamiast zimnego szarego). Warianty dzienny + nocny.

### Faza 2 — wspólne prymitywy
- `ArcadeButton`: nowy wariant `cta` (pomarańczowy) + disabled czyta tokeny motywu zamiast hardcoded `#6B7280`.
- `AppHeader` i `StackScreenHeader`: tytuły na pixel-font (`PressStart2P`) zamiast systemowego `fontWeight:'700'`.

### Faza 3 — migracja ekranów
- `OnboardingScreen`: pełna zgodność z `vision/` — nagłówek „Krok X z 3 — …", kropki postępu, biała lista z zieloną selekcją + ptaszek, pomarańczowe CTA `DALEJ`/`DOŁĄCZ`.
- `RideDashboardScreen`: główne CTA „DO JAZDY" na zielono (`success`) zgodnie z mockiem.
- Sweep inline-hex → tokeny: `CityHubScreen` (`#bbf29b`/`#ffffff`/`#e1e3da`/rival), `GpsDiagnosticsScreen` (badge OK/FAIL).

### Walidacja
- `jest`: 20 suites / 100 testów PASS (z aktualizacją testu onboardingu pod nowy layout).
- `tsc`: brak nowych błędów w edytowanych plikach (pozostałe błędy to preexistujące braki typów `react-test-renderer` w testach).

## Gate 56/56

### Onboarding
| Plik vision | Ekran | Backing code | Status |
|---|---|---|---|
| `00_onboarding_city.png` | Krok 1 — miasto | `OnboardingScreen.tsx` (CityStep) | DONE (code) |
| `00_onboarding_department.png` | Krok 2 — drużyna | `OnboardingScreen.tsx` (DepartmentStep) + fallback | DONE (code) |
| `00_onboarding_finish.png` | Krok 3 — gotowy | `OnboardingScreen.tsx` (FinishStep) | DONE (code) |
| `00_onboarding_complete.png` | Po onboardingu → shell | `useAuthSession.ts` / `App.tsx` | DONE (code) |
| `00_main_after_onboarding.png` | Wejście do app | `NavigationShell.tsx` | DONE (code) |

### Zakładki / ekrany główne
| Plik vision | Ekran | Backing code | Status |
|---|---|---|---|
| `01_ride_dashboard.png` | Jazda — dashboard | `RideDashboardScreen.tsx` | PARTIAL |
| `02_active_ride_hud.png` | HUD jazdy | `ActiveRideHUDScreen.tsx` + `components/ride/*` | PARTIAL |
| `03_ride_paused.png` | Pauza jazdy | `RidePausedScreen.tsx` | PARTIAL |
| `03b_ride_stopped.png` | Jazda zatrzymana | `RidePausedScreen.tsx` / `RideSummaryScreen.tsx` | PARTIAL |
| `04_gps_diagnostics.png` | Kreator GPS | `GpsDiagnosticsScreen.tsx` | PARTIAL |
| `05_compete_hub.png` | Rywalizacja | `CityHubScreen.tsx` | PARTIAL |
| `06_compete_scrolled.png` | Rywalizacja scroll | `CityHubScreen.tsx` | PARTIAL |
| `07_clubs.png` | Kluby | `ClubsDirectoryScreen.tsx` | PARTIAL |
| `08_segments.png` | Segmenty | `SegmentsScreen.tsx` | PARTIAL |
| `09_explore_hub.png` | Odkrywaj | `ExploreHubScreen.tsx` | PARTIAL |
| `10_explore_map.png` | Mapa POI | `ExploreMapScreen.tsx` | PARTIAL |
| `11_marketplace.png` | Marketplace | `MarketplaceScreen.tsx` | PARTIAL |
| `12_profile.png` | Profil | `AthleteProfileScreen.tsx` | PARTIAL |
| `13_profile_scrolled.png` | Profil scroll | `AthleteProfileScreen.tsx` | PARTIAL |
| `14_trends.png` | Trendy | `PerformanceTrendsScreen.tsx` | PARTIAL |
| `15_leaderboard.png` | Ranking | `GlobalLeaderboardScreen.tsx` | PARTIAL |
| `16_training_log.png` | Dziennik treningów | `TrainingLogScreen.tsx` | PARTIAL |
| `19_final.png` | Stan końcowy Jazda | `RideDashboardScreen.tsx` | PARTIAL |

### Pliki robocze (DEV-VAR — pokryte przez kanoniczne ekrany)
| Grupa | Pliki | Kanoniczny ekran |
|---|---|---|
| Onboarding iter. | `onb_0..2`, `onb_step_0..5`, `_current`, `_now`, `_restart`, `_state`, `_after_clear`, `_main_check` | `00_onboarding_*` |
| Progres iter. | `prog_0..9` | `00_onboarding_*` / `01_ride_dashboard` |
| Kroki iter. | `step_0_dept`, `step_1..7_finish` | `00_onboarding_department/finish` |

## Postęp 2026-06-15 — cleanup → bramki → harness → wizja→kod

Wizualizacje per krok w [`screenshots/2026-06-15-parity-progress/`](screenshots/2026-06-15-parity-progress/).

| Krok | Co zrobiono | PNG |
|------|-------------|-----|
| A1 cleanup | Usunięto `EnergyBar`, `src/features/`, osierocone assety (ghost_sheet, marker_cyclist; hud_mockup→docs) + wpisy w rejestrach | `faza-A-krok1-cleanup.png` |
| A2 tokeny/i18n | Martwe klucze i18n usunięte; mobile odcięte od `@tokens/*` (grandPrix.ts SSOT; admin nadal używa packages/tokens); 23 kanoniczne + 33 zarchiwizowane vision; usunięto `react-native-qrcode-svg` | `faza-A-krok2-tokeny-i18n.png` |
| B1 tsc | Test: jawny typ `ReactTestInstance`; `@types/react-test-renderer` zadeklarowane (braki modułów = pełny install CI) | `faza-B-krok1-tsc.png` |
| B2 gates | `coverageThreshold` (baseline ~24%); test parytetu i18n PL↔EN; guard `audit:screen-tokens` (0 inline hex; 86 fontWeight tracked) | `faza-B-krok2-gates.png` |
| B3 CI/audyty | `ci.yml` mobile: dodano typecheck + token-guard; `audit:imports` 0 dead, `audit:mobile` 0 błędów | `faza-B-krok3-ci-audyty.png` |
| C1 fixtures | `EXPO_PUBLIC_VISION_FIXTURES` + dane 1:1 z mocków (profil/compete/ride) + test | `faza-C-krok1-fixtures.png` |
| C2 harness | `vision_parity_harness.py` (SSIM/pixel-diff + composites), smoke 23/23 PASS; czeka na screenshoty z emulatora | `faza-C-krok2-harness.png` |
| D1 assety | 25 definicji w generatorze: 5 herbów, 4 ikony działów, 10 odznak, avatar frame, frame 9-slice, 2 banery, sky sunset/night | `faza-D-krok1-assety.png` |
| D2 komponenty | 9 komponentów asset-optional: OrnateFrame, CrestIcon, DepartmentIcon, AchievementGrid, AvatarFramed, CityBanner, VersusBar, LaurelHeader, FinishCelebration | `faza-D-krok2-komponenty.png` |
| D3 wiring | Sceny always-on (domyślnie ON + reduced-motion fallback); `FONTS.display` (swap do Silkscreen w 1 linii); resolvery tenant→crest, dept→icon | `faza-D-krok3-wiring.png` |
| D4 integracja | Onboarding: crest w liście miast, ikony działów, scena finish META (reszta ekranów ma komponenty gotowe do wpięcia) | `faza-D-krok4-onboarding-beforeafter.png` |

Stan jakości po etapie: 109 testów / 23 suites PASS; 0 inline-hex w `screens`; audyty zielone.

## Postęp 2026-06-16 — pętla przechwytywania (Faza E)

| Krok | Co zrobiono | PNG |
|------|-------------|-----|
| E1.1 skip onboarding | `App.tsx`: gdy `isVisionFixtures()` build pomija onboarding i wpada w `MainTabs` (capture realnych ekranów) | `faza-E-krok1-skip-onboarding.png` |
| E1.2 vision gallery | `VisionGalleryScreen` (dev/fixtures-only) + deep-link `fourvelo://vision-gallery`; 15 deterministycznych celów nawigacji | `faza-E-krok2-gallery.png` |
| E1.3 fixtures w ekranach | Leaderboard/Trends/TrainingLog czytają fixtures (RideDashboard już wcześniej); 111 testów PASS | `faza-E-krok3-fixtures-screens.png` |
| E2.1 metryka | Harness: SSIM kierunkowo (próg 0.6) + `--report-only` + generowanie `checklist.md` (layout/typografia/assety/dane/empty) | `faza-E-krok4-metryka.png` |
| E2.2 CI + gate | `vision-parity.yml`: próg 0.6 + `--report-only` (nie failuje), artefakt z checklistą; definicja metryki w tym dokumencie | (ten wpis) |

### Definicja metryki 1:1 (ważne)
- `vision/` to **ręcznie rysowane ilustracje** (pełne sceny, cykliści, tłumy). Działająca apka RN **nie osiągnie** SSIM ~0.92 wobec nich.
- **SSIM = sygnał trendu** (próg kierunkowy 0.6), nie bramka. CI używa `--report-only` (nie blokuje).
- **Bramką jest checklist per-ekran**: `layout / typografia / assety / dane / empty-state` (artefakt `checklist.md` z harnessu) — ocena human-review.
- Diagnoza audytu 2026-06-15: zrzuty „nie-onboarding" faktycznie pokazują onboarding → po E1 (skip + gallery + fixtures) kolejny capture build złapie realne ekrany.

## Pozostało do sign-off na urządzeniu (Faza weryfikacji)
1. Rebuild APK (`build:local:preview:android`) + rerun `python scripts/emulator-ui-audit.py` → zebrać realne zrzuty 19 kroków.
2. Pixel-diff każdego `screenshots/.../NN_name.png` vs `vision/NN_name.png`; PARTIAL → DONE po potwierdzeniu.
3. Assety scen/ilustracji (parallax, herosi, banery miast) dla pełnej głębi mocków tam, gdzie UI komponentowe nie odwzoruje pełnej ilustracji.
4. Kontrast WCAG-AA na parchment + night chrome; czytelność tab bara (safe area 80px).
