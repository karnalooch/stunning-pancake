# 4VELO Mobile Recovery Architecture Audit — 2026-09-19

> **Status:** READY FOR REVIEW / architecture boundary finalized 2026-09-24  
> **Tracker:** #149, #151  
> **Baseline:** protected `main` at `30c0d4cb9502f6d92f75a5fd633e7624c213f809` (merge of #259)  
> **Scope:** evidence behind the mobile presentation/runtime migration boundary  
> **Normative visual authority:** `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` and `MOBILE_UI_DESIGN_CONTRACT_V1.md`  
> **Normative application target:** `MOBILE_APPLICATION_ARCHITECTURE_V1.md`, `MOBILE_RIDE_FLOW_V1.md`, `MOBILE_RUNTIME_ACCEPTANCE_V1.md`

## 1. Executive finding

The mobile problem was not one broken screen. Static and emulator evidence showed four coupled concerns:

1. modern Frozen UI v1.2 coexisted with legacy arcade/pixel presentation;
2. presentation frequently depended directly on API/GPS/storage services;
3. vision fixtures replaced displayed data but did not isolate the ride execution environment;
4. CI/static checks could be green without proving the critical Ride journey in a fresh runtime.

The migration decision is therefore **incremental shell + feature boundaries**, not a backend/GPS rewrite and not a whole-app visual big bang.

## 2. Runtime truth updated through #259

The original audit predated the completed durability proof chain. That is no longer open work.

Accepted physical evidence now covers:

- encrypted GPS payload recovery across process death — #256 PASS;
- lost encryption-key fail-closed behavior — #258 PASS;
- locked/background GPS producer durability — #259 PASS;
- same tracked activity continuity after force-stop/relaunch — #259 PASS.

These proofs are part of the current baseline. New UI work must preserve them; it must not reopen them merely because presentation changes.

Still open elsewhere:

- #156 — canonical clean prebuild/package/version/runtimeVersion and supported native-build provenance;
- #157 — final exact-artifact revalidation plus deterministic full Ride smoke.

Those items remain release/runtime gates, but they no longer block finalizing this architecture audit.

## 3. Current boot/composition finding

Current committed flow is conceptually:

```text
mobile/index.ts
  -> privacy/theme bootstrap
  -> App.tsx
      -> auth/session orchestration
      -> ride lifecycle orchestration
      -> NavigationShell
          -> screens
```

The `index.ts` bootstrap ordering is worth preserving. `App.tsx` and `NavigationShell.tsx` currently carry too much composition/orchestration responsibility and are migration sources rather than the target shell.

## 4. KEEP / REBUILD / DELETE-LATER

| Area | Decision | Reason |
|---|---|---|
| `mobile/index.ts` bootstrap ordering | **KEEP concept** | Early redaction/theme setup remains sound. |
| auth/session behavior | **KEEP behavior / rehome integration** | Proven behavior; new shell should consume a boundary. |
| API/service layer | **KEEP** | No need to rewrite transport/domain services for UI recovery. |
| ride/GPS/encryption/durability | **KEEP** | Physical recovery/background proofs are accepted. |
| `App.tsx` orchestration | **REBUILD composition** | Too many unrelated responsibilities. |
| `NavigationShell.tsx` | **REBUILD composition** | Navigation, fixture routes and feature callbacks are mixed. |
| primary IA intent | **KEEP** | Ride, Compete, Explore, Profile remain valid. |
| hidden Tracking bottom-tab pattern | **REBUILD** | Active Ride should live outside ordinary browsing. |
| product primitives / semantic roles | **KEEP / extend** | Aligned with Frozen UI. |
| routine legacy screen presentation | **REBUILD incrementally** | Mixed visual systems and service coupling remain. |
| Vision fixture execution boundary | **REBUILD** | Must isolate ride behavior, not only data display. |
| routine arcade primitives | **DELETE LATER / specialist only** | Not valid default product chrome. |
| generated legacy art as target | **DO NOT REUSE AS AUTHORITY** | Asset governance controls production use. |
| `com.sport.athlete` native identity | **KEEP for now** | Rename requires separate controlled migration. |

No speculative deletion is authorized by this audit.

## 5. Required dependency direction

The rebuild boundary is:

```text
screen
  -> feature hook/controller
  -> feature interface
  -> production or deterministic adapter
  -> existing services/domain
```

New feature screens must not directly depend on GPS managers, raw API clients, MMKV or SecureStore.

The detailed target is now normative in `docs/design/MOBILE_APPLICATION_ARCHITECTURE_V1.md`.

## 6. Ride fixture finding

The old vision path could change displayed Home/profile/etc. data while Start Ride still crossed real API/GPS/native storage.

Required replacement:

```text
RideController
  ├── ProductionRideController
  └── DeterministicRideController
```

Both must implement the same interaction contract. This is the basis of #152 and allows visual/runtime interaction tests to be deterministic without weakening production behavior.

## 7. Safe-area/layout finding

Safe-area ownership is inconsistent across current screens. The prior emulator pass included status-bar/layout overlap evidence.

The target architecture therefore requires a shared `ScreenLayout`/layout boundary for routine screens, with explicit special handling for full-screen Active Ride.

This is an implementation rule, not a request to patch every legacy screen before migration.

## 8. Home finding / #147

#147 contains useful T79 Home work:

- modern product primitives;
- dominant Start Ride CTA;
- real activity-history summary;
- explicit loading/empty/offline/error states;
- deterministic Home preview states;
- removal of routine legacy Home chrome.

Its historical manual FAIL happened before the current runtime recovery baseline.

Decision as of 2026-09-24:

- do not merge the stale branch blindly;
- refresh/revalidate it against current `main`;
- preserve its Home-only scope;
- perform fresh visual/runtime sign-off;
- merge only if the refreshed result is clean.

The architecture audit does not require discarding #147.

## 9. Ride Summary truth defect

The current legacy flow can reach a success-looking Summary when finalization is pending or failed.

That violates the Frozen UI requirement for three truthful terminal states:

```text
durable-success
pending-finalization
recovery-required
```

#154 owns the structural fix. The new Ride flow must route/render from terminal truth rather than `summary != null`.

## 10. Screen-level migration conclusions

- **Home:** refresh #147; use as the first current UI slice.
- **Active Ride:** keep functional map/data/lifecycle concepts; rebuild composition and control hierarchy.
- **Ride Summary:** rebuild around durable terminal truth.
- **Compete:** split data/controller from presentation before visual rebuild.
- **Explore:** later map-first rebuild; current landing/list behavior is not the target.
- **Profile:** preserve real stats/data contracts, rebuild presentation.
- **Onboarding:** rehome service/location orchestration behind a controller.
- **Segments/Clubs and secondary surfaces:** migrate later; no production-looking fake data outside explicit fixtures.

## 11. Native identity

Current native identifiers remain `com.sport.athlete`.

This audit explicitly does **not** authorize renaming them. Native identity migration requires a separate store/EAS/credentials/Firebase-aware decision.

## 12. First implementation slice

The first rebuilt shell milestone remains:

```text
Launch
 -> Home
 -> Start Ride
 -> Active Ride
 -> Pause
 -> Resume
 -> Finish
 -> Summary
 -> Home
```

Compete, Explore, Profile and secondary screens remain outside that first vertical slice.

## 13. Architecture handoff

The recovery audit is now evidence, not the long-term architecture manual.

Implementation authority is split intentionally:

- visual rules → `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` + `MOBILE_UI_DESIGN_CONTRACT_V1.md`;
- application boundaries → `MOBILE_APPLICATION_ARCHITECTURE_V1.md`;
- Ride state machine → `MOBILE_RIDE_FLOW_V1.md`;
- runtime/merge proof → `MOBILE_RUNTIME_ACCEPTANCE_V1.md`.

## 14. Exit for #151

This audit is ready for review when the branch contains the three handoff documents above and CI/review is clean.

#151 does not need to wait for final #157 closure. #157 remains the authoritative final runtime gate after #156 and the rebuilt Ride slice.
