# 4VELO Mobile Application Architecture v1

> **Status:** NORMATIVE for the mobile rebuild lane  
> **Decision date:** 2026-09-24  
> **Trackers:** #149, #151, #152, #153, #154  
> **Visual authority:** `MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md` and `MOBILE_UI_DESIGN_CONTRACT_V1.md`  
> **Runtime authority:** existing proven mobile services plus #156/#157 acceptance gates

## 1. Purpose

This document defines how new mobile UI is built from T80 onward. It is intentionally narrower than the recovery audit: the audit records what was found; this document defines the architecture to follow.

The rebuild is incremental. It does **not** authorize a big-bang rewrite, package-id migration, replacement of proven GPS/durability services, or deletion of legacy UI before parity is proven.

## 2. Core dependency rule

New presentation code follows one direction:

```text
screen / component
  -> feature hook or controller
  -> feature interface
  -> production or deterministic adapter
  -> existing service/domain layer
```

New screens must not directly import:

- raw API clients;
- `GpsSyncManager`;
- MMKV;
- SecureStore;
- encrypted GPS storage;
- native/background tracking implementations.

Those dependencies belong behind feature adapters.

## 3. App shell migration

The target shell is introduced beside the legacy shell:

```text
mobile/src/
  app/
    AppRoot.tsx
    providers/
    navigation/
  features/
    ride/
    home/
    onboarding/
    compete/
    explore/
    profile/
  ui/
    layout/
    primitives/
    feedback/
  services/
  domain/
  fixtures/
```

Migration rule:

1. preserve the current bootstrap ordering in `mobile/index.ts`;
2. add `AppRoot` as the new composition boundary;
3. keep legacy routes available until the corresponding vertical slice reaches parity;
4. move one user journey at a time;
5. delete legacy code only in a dedicated cleanup after replacement is proven.

`App.tsx` and `NavigationShell.tsx` are migration sources, not the target architecture.

## 4. RideController boundary

The Ride feature owns an explicit controller contract.

```text
RideController
  ├── ProductionRideController
  │     -> existing ride lifecycle
  │     -> Activity/API services
  │     -> GPS/background tracking
  │     -> encrypted/durable storage
  └── DeterministicRideController
        -> in-memory deterministic state machine
        -> no live API
        -> no GPS permission
        -> no native background dependency
```

Both adapters expose the same user-level operations and states. Presentation must not know which adapter is active.

Minimum operations:

- start;
- pause;
- resume;
- finish;
- acknowledge/recover terminal state;
- return Home.

The deterministic adapter is for vision, interaction and emulator smoke lanes. It must exercise the same navigation and presentation contracts as production.

## 5. Terminal ride truth

A completed recording and a durable success are not the same thing.

The controller must expose terminal truth explicitly:

```ts
type RideFinishState =
  | { kind: 'durable-success'; summary: RideSummary }
  | { kind: 'pending-finalization'; summary: RideSummary }
  | { kind: 'recovery-required'; summary?: RideSummary; reason: string };
```

Rules:

- only `durable-success` may trigger success celebration/haptics;
- pending upload/finalization must remain visibly pending;
- failure/recovery must never impersonate success;
- routing to Summary is driven by terminal state, not by `summary != null`;
- persistence/reconciliation follows the existing durability contracts.

#154 owns implementation of this rule.

## 6. ScreenLayout and safe-area contract

New primary screens use a common layout boundary from `ui/layout`.

The layout primitive owns:

- status-bar/top inset handling;
- bottom safe-area ownership;
- standard horizontal content padding;
- scroll vs fixed-content behavior;
- header placement;
- keyboard avoidance where applicable;
- background/surface role.

Feature screens must not independently invent safe-area policy unless the screen type requires it.

Special case: Active Ride may own a dedicated full-screen layout, but it must explicitly handle both top and bottom insets and outdoor readability.

## 7. Visual architecture rule

Frozen UI is the **product design system**. Pixel art is a **brand/emotion layer**.

Therefore:

- routine controls, cards, forms, navigation, metrics and status use modern product primitives;
- pixel art may appear in hero art, selected identity moments, achievements and truthful celebration states;
- Active Ride remains performance-first and almost free of decorative pixel art;
- no legacy generated art becomes production authority without asset-governance approval.

The existing visual authority documents remain normative; this document does not duplicate their token/color/typography rules.

## 8. Feature migration order

Current preferred order:

1. Home refresh / #147 on current `main`;
2. architecture handoff / #151;
3. canonical platform provenance / #156;
4. new AppRoot + deterministic RideController / #152;
5. durable terminal truth / #154;
6. first rebuilt Ride vertical slice / #153;
7. final exact-artifact runtime revalidation / #157;
8. later feature slices: Compete, Explore, Profile and secondary screens.

## 9. Definition of done for a major UI slice

Every major slice must have:

```text
design contract
  -> deterministic fixture/controller state
  -> unit + interaction tests
  -> visual contract checks
  -> exact-SHA emulator screenshots
  -> runtime smoke
  -> Aggregate CI gate
  -> manual visual sign-off where required
```

A static source-string assertion alone is not runtime proof.

## 10. Legacy policy

KEEP:

- API/service behavior that is still correct;
- auth/session behavior;
- ride/GPS/durability services;
- semantic product primitives;
- functional map/data concepts;
- current native identity until a separate migration decision.

REBUILD:

- app composition;
- navigation composition;
- presentation/service boundaries;
- routine legacy screen presentation;
- fixture execution boundary.

DELETE LATER:

- obsolete arcade/product duplicates;
- hidden tracking-tab pattern after replacement;
- legacy generated presentation assets no longer referenced;
- orphaned components proven unreachable.

No speculative deletion is allowed.
