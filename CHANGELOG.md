# CHANGELOG — SPORT Platform

## v0.1.0-beta.1 (2026-04-30) — Closed Beta

### Added
- **LLM-Powered Avatar Trainer** (`LlmCoachService`)
  - Dynamic, personality-driven coaching messages (Drill Sergeant / Motivator / Analyst)
  - OpenAI-compatible API via backend proxy (API key never leaves the server)
  - Circuit breaker (3 consecutive failures → 60s fallback)
  - Response cache per session with per-trigger-type keys
  - Rate limiting (max 1 call per 15s per trigger type)
  - Timeout handling (5s) with 1 retry
  - Graceful fallback to static Polish templates on any LLM failure
  - Firebase Crashlytics monitoring: P95 (>450ms) and P99 (>1900ms) latency tracking

- **System Intelligence AI** (Admin Dashboard)
  - Real-time LLM-powered analytical insights (Integrity Alerts, Growth Insights, Global Strategy)
  - Configurable model (default: gpt-4o) via `VITE_LLM_MODEL`
  - Static demo data fallback when LLM is unavailable

- **Backend LLM Proxy** (`/api/llm/proxy/`)
  - Routes mobile LLM requests through the server — API key stays server-side
  - CSRF-exempt, CORS-enabled, JSON-only endpoint

- **Test Suite** (40+ tests across 6 files)
  - `LlmCoachService.test.ts` — caching, circuit breaker, rate limiting, timeout, Polish, personality consistency
  - `AvatarTrainerService.test.ts` — session lifecycle, all 9 trigger categories, template variables, fallback
  - `TriggerEngine.test.ts` — priority queue, FIFO, deduplication, cooldown, auto-dismiss
  - `Integration.test.ts` — AvatarTrainerService + TriggerEngine end-to-end flow
  - `PopUpDialog.test.ts` — maxWidth 220, typewriter 40ms/char, sprites, animations, Solar Mode

### Fixed
- TypeScript compilation — `TriggerCategory` naming collision between `LlmCoachService` and `TriggerEngine` resolved
- TypeScript errors in `LeaderboardScreen`, `RewardsScreen`, `TrackingScreen` fixed
- `RewardsScreen` missing `View` import from tamagui
- Firebase Crashlytics — now conditionally initializes on native platforms

### Changed
- Version bumped to 0.1.0-beta.1 across all components
- `AvatarTrainerService` refactored: synchronous → async LLM-first dispatch with pending-trigger deduplication
- `dev.ps1` build tags updated from v2.1 to v0.1.0-beta.1
- `docker-compose.yml` — added LLM env args (`VITE_LLM_API_KEY`, `VITE_LLM_API_URL`, `VITE_LLM_MODEL`) to admin services

### Known Issues
- `@tremor/react` peer dependency conflict (React 19 vs React 18) — workaround: `--legacy-peer-deps`
- GPS spoofing detection still relies on pre-LLM heuristics (ML model pending)

---

## Previous Versions
*(v1.0.0 through pre-beta) — development builds prior to closed beta 0.1.0*
