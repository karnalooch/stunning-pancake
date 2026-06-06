# Event day burst protection (~50k users)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/EVENT_BURST_50K.md) |
| **canonical_path** | docs/pl/EVENT_BURST_50K.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

Burst protection is **automatic** by default (`EVENT_BURST_MODE=auto`). You do not need to set `EVENT_BURST_MODE=1` on Railway before event day.

> **Always-on layer (new).** Protection is now **two layers**:
> 1. **Global load guard** (`backend/core/load_guard.py`) — platform-wide, **always on**, independent of any event. Watches live join / session-start / telemetry-ingest rates and applies hard caps automatically (mode `GLOBAL_PROTECTION_MODE=auto`). Under normal load it is a no-op; it only bites when a signal crosses its cap.
> 2. **Event burst** (`backend/events/burst.py`) — the original event-scoped limits described below.
>
> Request flow: `request → global guard → event burst`. See [Always-on global protection](#always-on-global-protection-platform-wide) and [operations/TELEMETRY_SHARDING.md](./operations/TELEMETRY_SHARDING.md).

**Powiązane:** [operations/SIMULATOR.md](./operations/SIMULATOR.md) · [SCALE_TEST_300K.md](./SCALE_TEST_300K.md) · [operations/TELEMETRY_SHARDING.md](./operations/TELEMETRY_SHARDING.md) · [adr/011-telemetry-ingest-durability-under-load.md](./adr/011-telemetry-ingest-durability-under-load.md) (proposed)

## Always-on global protection (platform-wide)

The global load guard protects the platform **whether or not an event exists** — e.g. a viral spike, a botted endpoint, or an unscheduled mass start. It mirrors the simulator routing-backpressure design (hard cap + hysteresis + fail-open).

| Signal | Window | Default cap (env) | Engaged when |
|--------|--------|-------------------|--------------|
| Joins | 60 s | `GLOBAL_MAX_JOIN_PER_MINUTE=8000` | rate ≥ 90 % of cap |
| Session starts | 60 s | `GLOBAL_MAX_SESSION_PER_MINUTE=5000` | rate ≥ 90 % of cap |
| Telemetry ingest | 1 s | `GLOBAL_MAX_INGEST_PER_SECOND=20000` | rate ≥ 90 % of cap |
| Concurrent riders | — | `GLOBAL_MAX_CONCURRENT_RIDERS=50000` | effective cap = `min(platform, event)` |

- **Mode** `GLOBAL_PROTECTION_MODE` = `auto` (default) | `on` (always enforce) | `off` (disable).
- **Hysteresis** — once a signal trips, it stays "engaged" for 120 s so the platform doesn't flap around the threshold.
- **Fail-open** — any Redis error returns "allowed". Protection must never take the platform down.
- **Safe defaults** — caps are high, so normal traffic sees no change; limits only engage under genuine overload.
- **429 responses** — `POST /api/events/events/{id}/join/` and `POST /api/activities/sessions/` return `429 + Retry-After` with `detail_pl` when the global guard throttles, *before* event-scoped logic runs.
- **Telemetry ingest** — the FastAPI telemetry service (`telemetry/main.py`) enforces the same per-second cap on `/api/telemetry/ingest` and `/ingest/batch`, returning `429 + Retry-After` always (not event-gated). The Django simulator publish path feeds the same global ingest signal.

```env
# auto (default) | on (always enforce) | off (disable)
GLOBAL_PROTECTION_MODE=auto
GLOBAL_MAX_JOIN_PER_MINUTE=8000
GLOBAL_MAX_SESSION_PER_MINUTE=5000
GLOBAL_MAX_INGEST_PER_SECOND=20000
GLOBAL_MAX_CONCURRENT_RIDERS=50000
GLOBAL_PROTECTION_ENGAGE_RATIO=0.9
```

Structured logs: `loadguard.engaged`, `loadguard.throttled` (same style as `sim.routing.*`).

## What “50k users” means

| Scenario | What happens | System limit |
|----------|----------------|--------------|
| **50k app opens** | Users open the app, browse, tap “join event” | Soft-capped by `EVENT_JOIN_RATE_PER_MINUTE` (default 5k/min per event) when burst is active |
| **50k session starts** | Users tap “start ride” at once | `EVENT_SESSION_START_RATE_PER_MINUTE` (default 3k/min); excess gets 429 + queue |
| **50k simultaneous GPS** | All publishing live telemetry | **Target** — `EVENT_MAX_CONCURRENT_RIDERS=50000`, telemetry shards, `LIVE_MAP_FULL_SCALE=1` on event day; map uses LOD (H3/meso counts + micro markers), not random subsampling |

Graceful degradation: Postgres and Django see staggered joins and session creates, not a single thundering herd.

## When burst turns on (auto mode)

Any of these enables rate limits for an event:

1. **Large + live window** — `Participation` count ≥ `EVENT_BURST_AUTO_MIN_PARTICIPANTS` (default 1000) and event is `ACTIVE`, or `PUBLISHED` within `EVENT_BURST_PUBLISHED_HOURS_BEFORE_START` hours of `start_date`
2. **Load spike** — Redis sliding window: joins &gt; 200/min (`EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD`), or &gt; 500 joins/min, or &gt; 300 session starts/min → sets `{event_id}:burst:auto` for 2h
3. **Warm task** — `warm_event_start` sets `{event_id}:burst:active` when participants ≥ threshold or `SCALE_EVENT_LOAD_TEST=1`

Small events (&lt; auto min participants) are **not** rate-limited unless a load spike is detected.

## API

- `POST /api/events/events/{id}/join/` — idempotent join (200 if already joined, 201 if new, 429 if rate limited + `Retry-After`)
- `GET /api/events/events/{id}/` — includes `burst_protection` (`enabled`, `mode`, stagger hint, join_allowed, rates)
- `POST /api/activities/sessions/` — optional `event_id`; burst limits when protection is active for that event

## Environment variables (optional tuning)

```env
# auto (default) | on (always limit) | off (dev only)
EVENT_BURST_MODE=auto

# Auto-enable when participation count reaches this
EVENT_BURST_AUTO_MIN_PARTICIPANTS=1000
EVENT_BURST_PUBLISHED_HOURS_BEFORE_START=24

# Load spike detection (60s sliding window)
EVENT_BURST_LOAD_SPIKE_JOIN_THRESHOLD=200
EVENT_BURST_LOAD_JOIN_THRESHOLD=500
EVENT_BURST_LOAD_SESSION_THRESHOLD=300
EVENT_BURST_AUTO_TTL_SECONDS=7200

# Rate limits when burst is active
EVENT_MAX_CONCURRENT_RIDERS=50000
LIVE_MAP_FULL_SCALE=1
SCALE_TELEMETRY_API_MAX_LIMIT=50000
EVENT_START_STAGGER_SECONDS=600
EVENT_JOIN_RATE_PER_MINUTE=5000
EVENT_SESSION_START_RATE_PER_MINUTE=3000

# Load-test live sim as event
SCALE_EVENT_LOAD_TEST=1
```

Legacy: `EVENT_BURST_MODE=1` → `on`, `EVENT_BURST_MODE=0` → `off`.

### Before go-live

1. `python manage.py warm_event <event_id>` or Celery `events.tasks.warm_event_start` (runs automatically when event goes ACTIVE)
2. Preflight: `GET /api/activities/admin/scale-preflight/?target_users=50000&event_day=true` — reports burst mode `auto`
3. Ensure `publish_scheduled_events` beat runs (activates PUBLISHED → ACTIVE and warms cache)

### During event

- Monitor 429 rate on join/session endpoints
- Optionally run `process_event_start_queue.delay(event_id)` on a schedule if many queued starts
- Do **not** run 300k batch sim and event day on the same Postgres without wipe

## Celery tasks

| Task | Purpose |
|------|---------|
| `events.tasks.warm_event_start` | Reset Redis counters, set `burst:active` for large events, cache meta |
| `events.tasks.process_event_start_queue` | Drain deferred session starts |
| `events.tasks.start_event_session_async` | Create session from queue |

## Honest limits

- **50k registrations over ~10 minutes** is realistic with default join rate (5k/min).
- **50k concurrent riders** on the live index is the target (`EVENT_MAX_CONCURRENT_RIDERS=50000`); at country zoom use H3/meso aggregates with full counts, at z≥12 request up to 50k micro positions per viewport.
- The live-position index is **horizontally sharded** across N Redis shards with Phase 2 per-shard client routing — see [operations/TELEMETRY_SHARDING.md](./operations/TELEMETRY_SHARDING.md). Set `TELEMETRY_SHARD_COUNT=4+` on backend + simulation worker; optional `REDIS_TELEMETRY_SHARD_NODES` for dedicated Redis per shard. Load-test scaffold: [operations/TELEMETRY_LOAD_TEST.md](./operations/TELEMETRY_LOAD_TEST.md).
- Use staggered starts and client-side retry on 429 (global guard + event burst).

See also: [SCALE_TEST_300K.md](./SCALE_TEST_300K.md) for batch/live sim scale · [operations/TELEMETRY_SHARDING.md](./operations/TELEMETRY_SHARDING.md) for sharding rollout.
