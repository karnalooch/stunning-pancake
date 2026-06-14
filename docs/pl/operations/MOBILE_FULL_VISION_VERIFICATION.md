# Mobile Full Vision — Verification Gate

## Scope

Checklist dla przebudowy mobile 4VELO (full rebuild/full vision) przed merge/release.

## 1) Unit / integration

- `navigation`: kontrakt tras (`MainTabs`, stack overlays, deep link parsing).
- `services/performanceBudget`: reguły min/max i emisja violation event.
- `services/gpsSync*`: retry, outbox, recovery po utracie sieci.
- `app/useRideLifecycle`: edge states start/stop/recovery.
- `services/apiClient`: auth refresh i session-expired flow.

## 2) Smoke E2E (Maestro)

- `auth-login.yaml`: login i przejście do shell.
- `ride-lifecycle.yaml`: start → pause → stop → summary.
- `gps-recovery-banner.yaml`: odtworzenie niewysłanych punktów.
- `immersive-theme-smoke.yaml`: spójność UI po zmianie motywu.

## 3) Manual QA (P0)

- Deep links:
  - `fourvelo://profile/activity/<id>`
  - `fourvelo://explore/map`
  - `fourvelo://explore/marketplace`
  - `fourvelo://settings`
- Ride HUD:
  - status GPS + zegar + bateria,
  - stop confirmation hold,
  - voice cue przy GPS recovery/paused.
- Settings:
  - sekcje (`Ogólne`, `Sensory`, `Prywatność`, `Garaż`),
  - connect Strava/Garmin i ręczna synchronizacja.

## 4) Release hardening

- `EXPO_PUBLIC_API_URL` i `EXPO_PUBLIC_TELEMETRY_URL` ustawione dla target env.
- Brak regresji P0: auth, ride lifecycle, telemetry durability.
- Crash/perf telemetry aktywne na buildzie release.
- Aktualizacja dokumentacji EN/PL po zamknięciu zakresu.
