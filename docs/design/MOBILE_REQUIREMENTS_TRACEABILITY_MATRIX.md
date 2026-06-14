# Mobile Requirements Traceability Matrix — 4VELO

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / QA Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Mobile engineers, QA, product, release |
| **lang** | en |
| **translation** | [Polski](../pl/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |
| **canonical_path** | docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md |
| **Related** | [DESIGN_SYSTEM_MOBILE.md](./DESIGN_SYSTEM_MOBILE.md) · [ADR 014](../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) · [DATA_RESILIENCE.md](../pl/DATA_RESILIENCE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](../en/operations/MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Purpose

Single matrix connecting:

- product/design requirements,
- implementation locations,
- verification evidence,
- residual risks.

Use this file as the release gate for "are we really done?".

---

## 1) Functional requirements matrix

| Req ID | Requirement | Canonical source | Primary implementation | Verification | Residual risk |
|--------|-------------|------------------|-------------------------|--------------|---------------|
| FR-01 | User can sign in/register and restore session | `CONSTITUTION`, auth UX docs | `mobile/src/app/useAuthSession.ts`, `mobile/src/app/AuthScreen.tsx`, `mobile/src/services/apiClient.ts` | auth smoke flow + manual relaunch | OAuth provider edge cases |
| FR-02 | User can start/pause/resume/stop ride | `DESIGN_SYSTEM_MOBILE` §3 | `mobile/src/app/useRideLifecycle.ts`, `mobile/src/screens/ActiveRideHUDScreen.tsx`, `mobile/src/components/ride/RideActionBar.tsx` | ride lifecycle smoke | rare pause/stop race conditions |
| FR-03 | Ride summary is shown after stop | `DESIGN_SYSTEM_MOBILE` §7 | `mobile/src/screens/RideSummaryScreen.tsx`, `mobile/src/app/NavigationShell.tsx` | lifecycle smoke + manual | missing activity id linkage in some flows |
| FR-04 | Configurable ride data grid/presets | `DESIGN_SYSTEM_MOBILE` §3 | `mobile/src/components/ride/DataFieldGrid.tsx`, `mobile/src/ride/dataFields.ts`, `mobile/src/ride/layouts.ts` | manual layout edit + persistence check | schema migrations as fields evolve |
| FR-05 | Explore map and POI flows | `DESIGN_SYSTEM_MOBILE` §4 | `mobile/src/screens/ExploreMapScreen.tsx`, `mobile/src/services/api.ts` (`POIService`) | manual map/POI validation | backend POI data completeness |
| FR-06 | Marketplace shows balances/pools and redeem action | product/docs marketplace | `mobile/src/screens/MarketplaceScreen.tsx`, `mobile/src/services/api.ts` (`RewardsService`) | manual + API failure fallback | payment/reward backend edge behaviors |
| FR-07 | City competition hub + leaderboard available | `DESIGN_SYSTEM_MOBILE` §7 | `mobile/src/screens/CityHubScreen.tsx`, `mobile/src/screens/GlobalLeaderboardScreen.tsx` | manual + cache fallback check | stale cache windows |
| FR-08 | Profile, training log, and activity detail available | profile/training docs | `mobile/src/screens/AthleteProfileScreen.tsx`, `mobile/src/screens/TrainingLogScreen.tsx`, `mobile/src/screens/ActivityDetailScreen.tsx` | manual drilldown | detail screen partial placeholders |
| FR-09 | Settings include rider/sensor/privacy controls | full vision plan + ops | `mobile/src/screens/SettingsScreen.tsx`, `mobile/src/services/RiderPreferencesService.ts`, `mobile/src/services/api.ts` (`PrivacyService`, `WearableService`) | manual sections walkthrough | wearables external auth reliability |
| FR-10 | Deep links route into critical screens | navigation contract | `mobile/src/navigation/linking.ts`, `mobile/src/navigation/routeContract.ts`, `mobile/src/navigation/types.ts` | unit test + manual URL open | platform-specific URI handling |
| FR-11 | Voice cues support eyes-free use | `DESIGN_SYSTEM_MOBILE` §6 | `mobile/src/services/VoiceCueService.ts`, `mobile/src/screens/ActiveRideHUDScreen.tsx` | manual cue trigger | OS TTS differences |
| FR-12 | Hero/brand visual consistency via assets | Grand Prix design docs | `mobile/src/assets/assetRegistry.ts`, `mobile/src/assets/chromeIcons.ts`, `mobile/src/components/ui/*` | visual QA snapshots | remaining legacy component drift |

---

## 2) Non-functional requirements matrix

| Req ID | Non-functional requirement | Target | Implementation anchors | Verification | Residual risk |
|--------|----------------------------|--------|------------------------|--------------|---------------|
| NFR-01 | HUD performance | target 60 FPS, floor 55 FPS | `mobile/src/hooks/useFrameBudgetMonitor.ts`, `mobile/src/services/performanceBudget.ts`, `mobile/src/hooks/useMotionDegrade.ts` | perf budget logs + manual stress | old devices may degrade below floor |
| NFR-02 | Telemetry durability | no silent GPS data loss in normal offline/reconnect scenarios | `mobile/src/services/gpsSyncUpload.ts`, `mobile/src/services/GpsSyncManager.ts`, `mobile/src/services/gpsSyncStorage.ts` | gps recovery smoke + manual airplane-mode test | extreme long offline sessions |
| NFR-03 | Auth security | token storage in SecureStore and safe refresh flow | `mobile/src/services/authTokenStorage.ts`, `mobile/src/services/apiClient.ts` | unit/integration auth tests | social auth callback variability |
| NFR-04 | Accessibility motion safety | reduced motion respected | `mobile/src/hooks/useMotionPolicy.ts`, motion-aware components | manual system setting validation | incomplete coverage in legacy animations |
| NFR-05 | Readability in outdoor use | high-contrast HUD chrome | `mobile/src/components/ride/*`, theme tokens in `mobile/src/theme/stitch.ts` | field QA on device | brightness/device variability |
| NFR-06 | i18n parity | no missing keys in PL/EN | `mobile/src/i18n/strings.pl.ts`, `mobile/src/i18n/strings.en.ts` | lint/test/manual UI pass | fast feature development can bypass parity |
| NFR-07 | Error resilience | recoverable edge states for API/network failures | `mobile/src/components/ui/EdgeStateBanner.tsx`, screen-level fallback usage | manual network-failure matrix | inconsistent fallback copy/text tone |
| NFR-08 | Operational diagnosability | capture crashes/perf violations | `mobile/src/services/FirebaseService.ts`, `mobile/src/services/performanceBudget.ts` | smoke + telemetry dashboard checks | disabled telemetry in some builds |

---

## 3) Screen-level acceptance map

| Screen | Must-have acceptance checks |
|--------|-----------------------------|
| `AuthScreen` | login/register works, social callback safe fallback, clear error message |
| `RideDashboardScreen` | start ride CTA works, settings/gps access works, start failure is visible |
| `ActiveRideHUDScreen` | map + metrics + status bar + action bar + recovery banner + motion-safe behavior |
| `RidePausedScreen` | resume/stop flow correct, no navigation dead end |
| `RideSummaryScreen` | summary values valid, share action does not crash, return to hub works |
| `CityHubScreen` | city wars and leaderboard render with cache fallback |
| `ExploreHubScreen` | map and marketplace entries route correctly |
| `ExploreMapScreen` | map renders, POI markers and fallback states work |
| `MarketplaceScreen` | balance/pools/redeem flow safe under API errors |
| `AthleteProfileScreen` | profile stats visible, navigation to training/settings/trends works |
| `TrainingLogScreen` | activity list loads and opens detail |
| `ActivityDetailScreen` | valid detail rendering + fallback if data missing |
| `GlobalLeaderboardScreen` | online load + offline cache fallback |
| `PerformanceTrendsScreen` | derived stats from history + fallback path |
| `SettingsScreen` | section switching, preference persistence, wearable actions safe fallback |

---

## 4) Test evidence map (minimum)

| Layer | Minimum evidence |
|-------|------------------|
| Unit | navigation route contract tests, performance budget tests, auth token handling |
| Integration | API client refresh, ride lifecycle interactions with services |
| E2E smoke | auth login, ride lifecycle, GPS recovery, immersive theme |
| Manual QA | deep links, offline mode, settings sections, map/marketplace/profile drilldowns |

---

## 5) Change impact checklist

When a change lands, update this matrix if it affects:

- navigation contracts,
- ride lifecycle and telemetry,
- settings/privacy/wearable integrations,
- any performance/accessibility guarantees,
- any release-critical flow.

If matrix update is missing for impacted areas, release review is incomplete.
