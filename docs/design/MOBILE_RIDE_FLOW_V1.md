# 4VELO Mobile Ride Flow v1

> **Status:** NORMATIVE for #152/#153/#154  
> **Decision date:** 2026-09-24  
> **Related:** #149, #152, #153, #154, #157, #392

## 1. Canonical first vertical slice

```text
Launch
  -> Home
  -> Start Ride
  -> Active Ride
  -> Pause
  -> Resume
  -> Finish
  -> terminal truth
      -> durable success
      -> pending finalization
      -> recovery required
  -> Summary
  -> Home
```

This is the first end-to-end rebuilt mobile journey. Compete, Explore, Profile and secondary screens are not prerequisites.

## 2. State model

Minimum user-facing state machine:

```text
HOME
  | start
  v
STARTING
  | success
  v
ACTIVE <---- resume ---- PAUSED
  |                    ^
  | pause -------------|
  |
  | finish
  v
FINALIZING
  |----------------------|
  |                      |
  v                      v
DURABLE_SUCCESS      PENDING_FINALIZATION
  |                      |
  |                      v
  |                 RECOVERY_REQUIRED
  |                      |
  +-----------> SUMMARY <-+
                    |
                    | done
                    v
                   HOME
```

Start failure returns to a truthful recoverable Home state; it must not create a fake Active Ride.

## 3. Home contract

Home must:

- keep Start Ride visually dominant;
- remain usable if history/statistics are unavailable;
- show loading, first-use empty, offline cache and hard error distinctly;
- route an already-active recording back to Active Ride;
- use real activity history in production;
- allow deterministic fixture states in vision/smoke mode.

## 4. Start contract

On Start:

1. UI enters a bounded `STARTING` state;
2. duplicate starts are prevented;
3. production adapter creates/recovers the real ride and starts required tracking;
4. deterministic adapter advances without API/GPS/native dependencies;
5. navigation reaches Active Ride only after controller success;
6. failure returns a visible recoverable state.

## 5. Active Ride contract

Active Ride prioritizes:

1. functional map;
2. GPS/tracking state;
3. speed as the primary live metric;
4. secondary metrics;
5. large Pause control;
6. protected Stop/Finish action.

Requirements:

- sunlight readability;
- one-hand operation;
- explicit GPS health;
- no decorative scenic background;
- no fake metrics in production;
- correct safe areas.

## 6. Pause/resume contract

Pause must not finalize the ride and must not be implemented as presentation-only state.

The controller exposes semantic `pause()` / `resume()` commands. Presentation cannot set PAUSED directly.

### PAUSED producer semantics

On `ACTIVE -> PAUSED`:

- the same Activity identity is retained;
- the persisted encrypted tracking state becomes `isPaused=true`;
- the GPS producer is fenced before native location shutdown, so late callbacks cannot append points;
- already-buffered/outbox telemetry may continue uploading;
- live speed becomes zero;
- distance and elevation stop changing because no new ride points are accepted;
- ride elapsed time freezes and excludes the paused interval;
- Finish remains available and finalizes the points already recorded.

PAUSED survives process death. Relaunch restores the same Activity in PAUSED state and **does not** automatically restart the GPS producer.

### Resume semantics

On `PAUSED -> ACTIVE`:

- the same Activity identity is reused;
- accumulated paused wall time remains excluded from ride elapsed time;
- GPS point comparison state is reset;
- persisted last coordinate/altitude are cleared for distance accumulation;
- the first accepted point is marked as a new segment boundary;
- the native GPS producer is restarted only after the persisted state is ready.

The segment boundary prevents a rider who moved while paused from creating a synthetic route/distance jump across the pause.

### Presentation

PAUSED is rendered as a bounded overlay/sheet inside the same Active Ride composition. The underlying Ride context remains visible/recognisable. There is no normal product navigation to a separate `RidePaused` destination.

## 7. Finish/finalization contract

Finish is not considered successful merely because recording stopped.

The controller returns:

```ts
type RideFinishState =
  | { kind: 'durable-success'; summary: RideSummary }
  | { kind: 'pending-finalization'; summary: RideSummary }
  | { kind: 'recovery-required'; summary?: RideSummary; reason: string };
```

### Durable success

Allowed:

- success haptic;
- celebratory artwork/animation;
- completed language;
- normal Summary completion action.

### Pending finalization

Required:

- clearly pending language;
- no full success celebration;
- truthful upload/finalization status;
- retry/background reconciliation behavior according to durability services.

### Recovery required

Required:

- no success celebration;
- clear recovery/error language;
- preserved data where available;
- deterministic recovery/retry path.

## 8. Summary contract

Summary renders from terminal truth, not from route assumptions.

It may share common metrics across states, but status, actions and celebration must differ.

Returning Home must not erase unresolved durable work that current services are responsible for reconciling.

## 9. Deterministic test states

The deterministic Ride adapter must be able to force at least:

- normal start;
- start failure;
- active metrics;
- pause;
- resume;
- durable success;
- pending finalization;
- recovery required.

The canonical deterministic smoke is:

```text
Home -> Start -> Active -> Pause -> Resume -> Finish
-> durable-success Summary -> Home
```

Additional terminal-state tests force pending and recovery paths.

## 10. Production invariants

The rebuild must not weaken:

- encrypted GPS storage;
- process-death recovery;
- lost-key fail-closed behavior;
- locked/background GPS durability;
- activity identity continuity;
- telemetry/outbox durability;
- package/native identity controls.

Accepted physical GPS durability evidence from #256, #258 and #259 remains valid and is not reimplemented in UI code.
