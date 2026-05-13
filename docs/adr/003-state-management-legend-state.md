# ADR 003: State Management with Legend State

## Status
Accepted (2026-05-13)

## Context
Standard React state management libraries (Redux, Context API, MobX) often suffer from excessive re-renders, especially in performance-critical applications like a sports tracker where telemetry data updates every second. We needed a solution that provides:
1. **Fine-grained reactivity**: Only the specific component or even just the specific text field should update when a piece of data changes.
2. **Minimal Boilerplate**: Easy to define and consume state.
3. **Deep Observability**: Ability to observe nested objects without complex selectors.

## Decision
We chose **Legend State** (`@legendapp/state`) as the primary state management engine for the SPORT mobile application.
- All global services (e.g., `AvatarTrainerService`, `ThemeService`) expose their state as `observable` objects.
- Components consume this state using the `observer` HOC or `useObservable` hook.
- We leverage Legend State's ability to "sync" with external storage (MMKV) for persistence where necessary.

## Consequences
- **Positive**: High performance during active ride tracking. The HUD can update metrics at 10Hz+ without impacting UI responsiveness.
- **Positive**: Extremely clean code in services; state is modified directly via `.set()` and read via `.get()`.
- **Constraint**: Developers must be careful to use `.get()` only when a reactive value is needed, and avoid direct mutation of state objects without the `.set()` method to maintain observability.
