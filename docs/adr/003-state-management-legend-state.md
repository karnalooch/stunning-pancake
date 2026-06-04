# ADR 003: State Management with Legend State


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/adr/003-state-management-legend-state.md) |
| **canonical_path** | docs/adr/003-state-management-legend-state.md |

---

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |


## Status
Accepted (2026-05-13)

## Context
Standard React state management libraries (Redux, Context API, MobX) often suffer from excessive re-renders, especially in performance-critical applications like a sports tracker where telemetry data updates every second. In a typical React app, updating a 'speed' value might trigger a re-render of the entire dashboard. We needed a solution that provides:
1. **Fine-grained reactivity**: Only the specific component or even just the specific text field should update when a piece of data changes.
2. **Minimal Boilerplate**: Easy to define and consume state without complex actions or reducers.
3. **Deep Observability**: Ability to observe nested objects and arrays without performance degradation.
4. **Synchronous Performance**: Zero-latency state updates required for real-time sensor feedback.

## Decision
We chose **Legend State** (`@legendapp/state`) as the primary state management engine.

### Core Implementation
- **Services as Observables**: All global services (e.g., `AvatarTrainerService`, `ThemeService`) encapsulate their state within `observable` objects.
- **Direct Access**: We prefer direct `.set()` and `.get()` calls within services, avoiding the overhead of action dispatchers.
- **Computed State**: We use `.get()` within `computed` functions to derive complex metrics (e.g., average pace) reactively.

### Example: Reactive Metric Component
```tsx
import { observer } from '@legendapp/state/react';
import { avatarTrainer } from '@/services/AvatarTrainerService';

// This component ONLY re-renders when speedMs changes.
export const SpeedMetric = observer(() => {
    const speed = avatarTrainer.state.speedMs.get();
    return <Text>{(speed * 3.6).toFixed(1)} km/h</Text>;
});
```

## Consequences
- **Positive**: High performance during active ride tracking. The HUD can update metrics at 10Hz+ without impacting UI responsiveness.
- **Positive**: Developer productivity. Adding a new piece of state is a single line of code in an observable.
- **Negative / Risk**: The "Observer Pattern" requires developers to wrap components in `observer()`. Forgetting this leads to silent failures (state updates but UI stays stale).
- **Strategy**: Use the `enableLegendStateReact()` global flag to enable automatic tracking in small components if necessary, though explicit `observer` is preferred for clarity.
