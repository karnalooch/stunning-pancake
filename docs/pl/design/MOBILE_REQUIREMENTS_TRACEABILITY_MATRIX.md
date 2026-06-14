# Macierz traceability wymagań mobile — 4VELO

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / QA Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Mobile engineers, QA, product, release |
| **lang** | pl |
| **translation** | [English](../../design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |
| **canonical_path** | docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md |
| **Powiązane** | [DESIGN_SYSTEM_MOBILE.md](../../design/DESIGN_SYSTEM_MOBILE.md) · [ADR 014](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) · [DATA_RESILIENCE.md](../../pl/DATA_RESILIENCE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](../../pl/operations/MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Cel

Jedna tabela łącząca:

- wymagania produktowo-designowe,
- miejsca implementacji w kodzie,
- dowody testowe,
- ryzyka rezydualne.

To jest główna odpowiedź na pytanie "czy naprawdę jesteśmy gotowi?".

---

## 1) Macierz wymagań funkcjonalnych

| Req ID | Wymaganie | Źródło kanoniczne | Główna implementacja | Weryfikacja | Ryzyko rezydualne |
|--------|-----------|-------------------|-----------------------|-------------|-------------------|
| FR-01 | Użytkownik loguje/rejestruje się i sesja się odtwarza | `CONSTITUTION`, auth UX docs | `mobile/src/app/useAuthSession.ts`, `mobile/src/app/AuthScreen.tsx`, `mobile/src/services/apiClient.ts` | smoke auth + manual relaunch | edge-case OAuth provider |
| FR-02 | Użytkownik może start/pause/resume/stop jazdy | `DESIGN_SYSTEM_MOBILE` §3 | `mobile/src/app/useRideLifecycle.ts`, `mobile/src/screens/ActiveRideHUDScreen.tsx`, `mobile/src/components/ride/RideActionBar.tsx` | smoke ride lifecycle | rzadkie race condition pause/stop |
| FR-03 | Po stop jest podsumowanie jazdy | `DESIGN_SYSTEM_MOBILE` §7 | `mobile/src/screens/RideSummaryScreen.tsx`, `mobile/src/app/NavigationShell.tsx` | smoke lifecycle + manual | niepełne linkowanie activity id |
| FR-04 | Konfigurowalna siatka pól i presety | `DESIGN_SYSTEM_MOBILE` §3 | `mobile/src/components/ride/DataFieldGrid.tsx`, `mobile/src/ride/dataFields.ts`, `mobile/src/ride/layouts.ts` | manual edit + persistence | migracje schematu layoutów |
| FR-05 | Mapa Explore i POI | `DESIGN_SYSTEM_MOBILE` §4 | `mobile/src/screens/ExploreMapScreen.tsx`, `mobile/src/services/api.ts` (`POIService`) | manual mapa/POI | kompletność danych POI backend |
| FR-06 | Marketplace pokazuje balance/pools i redeem | docs produktowe marketplace | `mobile/src/screens/MarketplaceScreen.tsx`, `mobile/src/services/api.ts` (`RewardsService`) | manual + fallback przy API error | edge-case reward backend |
| FR-07 | City competition hub + leaderboard | `DESIGN_SYSTEM_MOBILE` §7 | `mobile/src/screens/CityHubScreen.tsx`, `mobile/src/screens/GlobalLeaderboardScreen.tsx` | manual + cache fallback | okno starych danych cache |
| FR-08 | Profil, dziennik i szczegóły aktywności | docs profile/training | `mobile/src/screens/AthleteProfileScreen.tsx`, `mobile/src/screens/TrainingLogScreen.tsx`, `mobile/src/screens/ActivityDetailScreen.tsx` | manual drilldown | częściowo placeholderowe sekcje detail |
| FR-09 | Ustawienia mają sekcje rider/sensory/privacy | full vision plan + ops | `mobile/src/screens/SettingsScreen.tsx`, `mobile/src/services/RiderPreferencesService.ts`, `mobile/src/services/api.ts` (`PrivacyService`, `WearableService`) | manual sekcje settings | stabilność zewnętrznych flow wearables |
| FR-10 | Deep linki prowadzą do kluczowych ekranów | kontrakt nawigacji | `mobile/src/navigation/linking.ts`, `mobile/src/navigation/routeContract.ts`, `mobile/src/navigation/types.ts` | unit test + manual open URL | różnice URI per platforma |
| FR-11 | Voice cues wspierają eyes-free | `DESIGN_SYSTEM_MOBILE` §6 | `mobile/src/services/VoiceCueService.ts`, `mobile/src/screens/ActiveRideHUDScreen.tsx` | manual trigger cue | różnice TTS OS |
| FR-12 | Spójność hero/brand przez assety | docs Grand Prix | `mobile/src/assets/assetRegistry.ts`, `mobile/src/assets/chromeIcons.ts`, `mobile/src/components/ui/*` | visual QA snapshots | pozostały drift legacy komponentów |

---

## 2) Macierz wymagań niefunkcjonalnych

| Req ID | Wymaganie niefunkcjonalne | Target | Kotwice implementacji | Weryfikacja | Ryzyko rezydualne |
|--------|----------------------------|--------|-----------------------|-------------|-------------------|
| NFR-01 | Wydajność HUD | target 60 FPS, floor 55 FPS | `mobile/src/hooks/useFrameBudgetMonitor.ts`, `mobile/src/services/performanceBudget.ts`, `mobile/src/hooks/useMotionDegrade.ts` | logi budget + manual stress | starsze urządzenia |
| NFR-02 | Trwałość telemetry | brak cichej utraty GPS w normalnych scenariuszach offline/reconnect | `mobile/src/services/gpsSyncUpload.ts`, `mobile/src/services/GpsSyncManager.ts`, `mobile/src/services/gpsSyncStorage.ts` | smoke GPS recovery + airplane mode test | bardzo długie sesje offline |
| NFR-03 | Bezpieczeństwo auth | tokeny w SecureStore + bezpieczny refresh | `mobile/src/services/authTokenStorage.ts`, `mobile/src/services/apiClient.ts` | testy auth + smoke | zmienność callback OAuth |
| NFR-04 | Accessibility motion safety | respektowanie reduced motion | `mobile/src/hooks/useMotionPolicy.ts`, komponenty motion-aware | manual test ustawień systemowych | niepełne pokrycie legacy animacji |
| NFR-05 | Czytelność w słońcu | kontrastowy HUD chrome | `mobile/src/components/ride/*`, tokeny `mobile/src/theme/stitch.ts` | QA na urządzeniu | zmienność jasności/ekranu |
| NFR-06 | Parzystość i18n | brak brakujących kluczy PL/EN | `mobile/src/i18n/strings.pl.ts`, `mobile/src/i18n/strings.en.ts` | lint/test/manual pass | szybkie feature'y mogą ominąć parity |
| NFR-07 | Odporność na błędy | recoverable edge states dla API/network | `mobile/src/components/ui/EdgeStateBanner.tsx`, fallbacki ekranowe | manual network-failure matrix | niespójny copy edge-state |
| NFR-08 | Diagnostyka operacyjna | crash + perf violations raportowane | `mobile/src/services/FirebaseService.ts`, `mobile/src/services/performanceBudget.ts` | smoke + dashboard checks | telemetry wyłączone w części buildów |

---

## 3) Mapa akceptacji per ekran

| Ekran | Kryteria akceptacji must-have |
|-------|-------------------------------|
| `AuthScreen` | login/register działa, social callback ma bezpieczny fallback, error jest czytelny |
| `RideDashboardScreen` | start ride działa, settings/gps wejścia działają, błąd startu jest widoczny |
| `ActiveRideHUDScreen` | mapa + metryki + status bar + action bar + recovery banner + motion-safe behavior |
| `RidePausedScreen` | resume/stop flow poprawny, brak dead-end nawigacji |
| `RideSummaryScreen` | wartości poprawne, share nie crashuje, powrót do hub działa |
| `CityHubScreen` | city wars i leaderboard renderują się z fallback cache |
| `ExploreHubScreen` | wejścia do mapy i marketplace prowadzą poprawnie |
| `ExploreMapScreen` | mapa renderuje, POI i fallback states działają |
| `MarketplaceScreen` | balance/pools/redeem bez crash przy API error |
| `AthleteProfileScreen` | statystyki widoczne, nawigacja training/settings/trends działa |
| `TrainingLogScreen` | lista aktywności ładuje się i otwiera detail |
| `ActivityDetailScreen` | poprawny render detail + fallback bez danych |
| `GlobalLeaderboardScreen` | ładowanie online + fallback offline cache |
| `PerformanceTrendsScreen` | statystyki wyliczane z historii + fallback |
| `SettingsScreen` | sekcje, zapis preferencji, akcje wearables z bezpiecznym fallback |

---

## 4) Mapa dowodów testowych (minimum)

| Warstwa | Minimalny dowód |
|---------|------------------|
| Unit | testy route contract, performance budget, auth token handling |
| Integration | API client refresh, interakcje ride lifecycle z services |
| E2E smoke | auth login, ride lifecycle, GPS recovery, immersive theme |
| Manual QA | deep linki, offline mode, sekcje settings, drilldown map/marketplace/profile |

---

## 5) Checklist impactu zmian

Aktualizuj tę macierz przy zmianach obejmujących:

- kontrakty nawigacji,
- ride lifecycle i telemetry,
- integracje settings/privacy/wearables,
- gwarancje performance/accessibility,
- krytyczne flow release.

Brak aktualizacji macierzy dla dotkniętego obszaru = review release niekompletny.
