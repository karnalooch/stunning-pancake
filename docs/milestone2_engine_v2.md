# Milestone 2: Engine V2 & Anti-Cheat — Technical Documentation

> **Status:** ✅ Released — tag `v0.2.0-alpha`
> **Commit:** `e5a926e`
> **Builds on:** [Milestone 1 — v0.1.0-alpha](developer_quickstart.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Plugin System v2 (pluggy)](#1-plugin-system-v2-pluggy)
3. [V-max Kinematic Anti-Cheat](#2-v-max-kinematic-anti-cheat)
4. [Async City Leaderboard (Redis Pipeline)](#3-async-city-leaderboard-redis-pipeline)
5. [Leaderboard REST API](#4-leaderboard-rest-api)
6. [React Native — New Screens](#5-react-native--new-screens)
7. [Celery Beat Schedule](#6-celery-beat-schedule)
8. [New Environment Variables](#7-new-environment-variables)
9. [Architecture Diagram](#8-architecture-diagram)

---

## Overview

Milestone 2 delivers three major engine upgrades and two new mobile screens:

| Component | Change | Impact |
|:---|:---|:---|
| Plugin System | Custom registry → **pluggy** | Isolated, testable plugins; pytest-compatible |
| Anti-Cheat | Simple speed check → **V-max heuristics** | <2% false positive rate; configurable thresholds |
| Leaderboard | Per-activity ZINCRBY → **Redis pipeline batch** | Handles 200+ concurrent finishes without data loss |
| REST API | — | `GET /api/activities/leaderboard/<city>/` (<5ms) |
| Mobile | Added **LoginScreen**, **HistoryScreen** | Full auth + history flow |

---

## 1. Plugin System v2 (pluggy)

### Why pluggy?

The custom `PluginRegistry` from Milestone 1 used a simple dict of callables.
`pluggy` (the same engine used by **pytest**) adds:

- **Hook specifications** (`HookSpec`) — formal contracts for each hook
- **Isolated plugin objects** — no shared state between plugins or tests
- **Tracing** — enabled automatically when `DEBUG=1`
- **First-class introspection** — `pm.get_hookimpls()`

### Hook Inventory

```python
# All hooks defined in SportHookSpec (core/plugin_registry.py)

activity_verified(activity)        # Activity passed all validation checks
activity_suspicious(activity, anomaly_ratio)  # V-max heuristics rejected the track
event_completed(event)             # Event transitioned ACTIVE → COMPLETED
club_created(club)                 # New club provisioned (triggers Matrix room)
```

### Backwards Compatibility

The old API still works — existing code using `registry.fire()` and `@registry.hook()` is fully supported:

```python
# OLD (Milestone 1) — still works
@registry.hook('activity.verified')
def my_handler(activity, **kwargs):
    ...

# NEW (Milestone 2) — recommended for new plugins
from core.plugin_registry import hookimpl, registry, PluginManifest

class MyPlugin:
    @hookimpl
    def activity_verified(self, activity):
        ...

manifest = PluginManifest(name='my_plugin', version='1.0.0',
                          author='dev', description='My plugin',
                          hooks=['activity.verified'])
registry.register(manifest, MyPlugin())
```

### Writing a Plugin

1. Create `backend/plugins/my_plugin.py`
2. Define a class with `@hookimpl` methods
3. Create a `PluginManifest`
4. Call `registry.register(manifest, MyPlugin())`
5. Add to `INSTALLED_APPS` or import in `AppConfig.ready()`

### DEBUG Tracing

Set `DEBUG=1` in `.env` to enable pluggy call tracing — every hook invocation
is logged with arguments and return values. Useful during development.

---

## 2. V-max Kinematic Anti-Cheat

### Architecture

The anti-cheat pipeline runs as **Step 3** in `process_activity_async()`:

```
raw GPS points
      ↓
  Kalman Filter (noise reduction)
      ↓
  analyze_anomalies()  ←─── NEW in Milestone 2
    ├── detect_speed_anomalies()   (per-segment V-max check)
    ├── consecutive run analysis   (3+ violations = reject)
    └── anomaly ratio check        (>20% = reject)
      ↓
  Viterbi HMM Map Matching
      ↓
  BRouter topological validation
      ↓
  is_verified: True/False + suspicious_reason
```

### V-max Thresholds

| Sport | V-max (m/s) | V-max (km/h) | With 10% margin |
|:---|:---:|:---:|:---:|
| `RUN` | 12.0 | 43.2 | 13.2 m/s |
| `BIKE` | 25.0 | 90.0 | 27.5 m/s |
| `WALK` | 3.5 | 12.6 | 3.85 m/s |
| `WHEELCHAIR` | 8.0 | 28.8 | 8.8 m/s |

### Rejection Criteria

An activity is marked `is_suspicious=True` if **either** condition is met:

| Rule | Default | Env var |
|:---|:---|:---|
| Anomaly ratio > threshold | >20% of segments | `VMAX_ANOMALY_RATIO` |
| Consecutive violations | ≥3 in a row | `VMAX_CONSECUTIVE` |
| Speed margin | 10% over V-max | `VMAX_MARGIN` |

### Example Output

```json
{
  "status": "done",
  "activity_id": 42,
  "is_verified": false,
  "anomaly_ratio": 0.23,
  "max_consecutive": 4,
  "suspicious_reason": "anomaly_ratio=23.00% exceeds 20% threshold",
  "distance_m": 5240.5
}
```

### Matrix Alert

When `is_suspicious=True`, the engine fires:
1. `activity.suspicious` plugin hook (catchable by any plugin)
2. Direct Matrix notification to `!admin_room_id:matrix.org`

---

## 3. Async City Leaderboard (Redis Pipeline)

### The Problem (Milestone 1)

Under 200 concurrent activity finishes, each triggered a separate `ZINCRBY` call:
- **200 individual Redis round-trips**
- Race conditions under Redis contention
- Leaderboard temporarily inconsistent

### The Solution (Milestone 2)

```
Activity finishes
       ↓
  ZINCRBY (immediate, real-time) ← still happens per-activity
       ↓
Every 5 minutes → Celery Beat triggers:
  recalculate_city_leaderboard(city_id)
       ↓
  SELECT SUM(distance) GROUP BY user_id  ← single DB query
       ↓
  redis.pipeline()
    .delete('leaderboard:city:siedlce')
    .zadd('leaderboard:city:siedlce', {uid: km, ...})  ← atomic replace
    .expire(...)
    .execute()
       ↓
  Leaderboard consistent ✓
```

### Key Methods

```python
from activities.leaderboards import LeaderboardService

# Real-time update (still used per activity)
LeaderboardService.update_score(user_id=42, entity_id='siedlce', score_delta=5.5)

# Batch recalculation (atomic Redis pipeline)
LeaderboardService.batch_recalculate('siedlce', {42: 105.3, 7: 88.1}, scope='city')

# Read (served from Redis, <5ms)
top = LeaderboardService.get_top_users('siedlce', limit=50)

# User-specific
rank  = LeaderboardService.get_user_rank('siedlce', user_id=42)
score = LeaderboardService.get_user_score('siedlce', user_id=42)

# Cleanup (called when event COMPLETED)
LeaderboardService.reset(event_id, scope='event')
```

### Cache TTL

| Operation | TTL |
|:---|:---|
| Per-activity write | extends to 30 min |
| Batch recalculate | sets to 30 min |
| Recalculation timestamp | 1 hour |
| Configurable via | `LEADERBOARD_CACHE_TTL` (seconds) |

---

## 4. Leaderboard REST API

### Endpoints

#### `GET /api/activities/leaderboard/<city_id>/`

Returns top athletes for a city. Served from Redis in <5ms.

**Auth:** Bearer JWT required

**Query params:**

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| `limit` | int | 50 | Max results (max 200) |
| `scope` | string | `city` | `city`, `event`, or `club` |

**Response 200:**
```json
{
  "city_id": "siedlce",
  "scope": "city",
  "updated_at": 1714000000.0,
  "count": 50,
  "leaderboard": [
    { "user_id": "42", "score": 105.3, "rank": 1 },
    { "user_id": "7",  "score": 88.1,  "rank": 2 }
  ]
}
```

**Response 202** (Redis empty, recalculating):
```json
{
  "status": "recalculating",
  "message": "Leaderboard is being calculated. Retry in 10 seconds."
}
```

---

#### `GET /api/activities/leaderboard/<city_id>/me/`

Returns the current user's rank and score.

**Response 200:**
```json
{
  "city_id": "siedlce",
  "user_id": 42,
  "rank": 1,
  "score_km": 105.3
}
```

---

## 5. React Native — New Screens

### LoginScreen

**File:** `mobile/src/screens/LoginScreen.tsx`

- Email + password form with JWT auth via `api.login()`
- `KeyboardAvoidingView` (iOS/Android compatible)
- Optimistic loading state
- Error display with branded error box
- Auto-submits on keyboard "Go"

### HistoryScreen

**File:** `mobile/src/screens/HistoryScreen.tsx`

- TanStack Query with 5-minute stale time (works offline)
- Summary banner: total activities / verified km / approval count
- Per-activity cards with: sport icon, date, distance, duration
- Green `✓ OK` badge for verified activities, `⏳` for pending
- Pull-to-refresh

### Navigation Update

Add `History` tab to `mobile/src/App.tsx`:

```tsx
<Tab.Screen
  name="History"
  component={HistoryScreen}
  options={{
    title: 'Historia',
    tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
  }}
/>
```

### New API Methods (api.ts)

```typescript
// City leaderboard (Milestone 2 endpoint)
await api.getCityLeaderboard('siedlce', 50);

// Current user rank
await api.getMyRank('siedlce');
// → { rank: 1, score_km: 105.3 }
```

---

## 6. Celery Beat Schedule

Full schedule after Milestone 2:

| Task | Schedule | Queue | Description |
|:---|:---|:---|:---|
| `recalculate_city_leaderboard` | Every 5 min | `default` | Atomic Redis pipeline batch recalc |
| `send_leaderboard_digest` | Monday 08:00 | `notifications` | Weekly Matrix digest |
| `close_expired_events` | Daily 00:05 | `default` | Auto-close + Redis cleanup |

Start Beat in Docker:
```bash
docker compose exec celery_beat celery -A core beat -l info
```

Or standalone:
```bash
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

---

## 7. New Environment Variables

Add these to `.env` (all are optional — defaults shown):

```bash
# V-max Anti-Cheat thresholds
VMAX_ANOMALY_RATIO=0.20    # >20% of segments above V-max → suspicious
VMAX_CONSECUTIVE=3          # 3+ consecutive violations → suspicious
VMAX_MARGIN=1.10            # 10% tolerance over biomechanical max

# Leaderboard cache
LEADERBOARD_CACHE_TTL=30    # Redis TTL multiplier in seconds (actual = x60)
```

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPORT Platform v2.0                      │
│                                                                 │
│  Mobile App (React Native 0.76)                                │
│  ├── LoginScreen     → POST /api/auth/token/                    │
│  ├── ActiveSession   → FastAPI WS :8001 (GPS ingest)           │
│  ├── HistoryScreen   → GET /api/activities/                     │
│  ├── EventsScreen    → GET /api/events/                         │
│  └── Leaderboard     → GET /api/activities/leaderboard/<city>/  │
│                                 ↓                               │
│  Django API :8000                                               │
│  ├── auth/           JWT (simplejwt)                            │
│  ├── activities/     CRUD + pipeline                            │
│  │     └── leaderboard/<city>/  ← Redis-first, <5ms            │
│  └── events/         OGC + tenant scoring                       │
│                                 ↓                               │
│  Celery Workers (critical queue)                                │
│  └── process_activity_async()                                   │
│        ├── Privacy masking                                      │
│        ├── Kalman filter                                        │
│        ├── V-max heuristics ← NEW                               │
│        │     ├── anomaly ratio check (>20%)                     │
│        │     └── consecutive run check (≥3)                     │
│        ├── Viterbi HMM map matching                             │
│        ├── BRouter validation                                   │
│        ├── LeaderboardService.update_score()  ← real-time      │
│        └── pluggy: fire(activity.verified)    ← NEW             │
│                  └── VoucherHotspotPlugin                       │
│                                 ↓                               │
│  Celery Beat (every 5 min)                                      │
│  └── recalculate_city_leaderboard()                             │
│        ├── DB: SELECT SUM(distance) GROUP BY user               │
│        └── Redis pipeline: DELETE + ZADD (atomic)              │
│                                                                 │
│  FastAPI Telemetry :8001                                        │
│  ├── POST /api/telemetry/ingest/batch   ← mobile GPS           │
│  ├── GET  /api/telemetry/live            ← HTTP fallback        │
│  ├── WS   /ws/telemetry/live            ← Admin Dashboard      │
│  └── _traccar_redis_bridge()  ← pub/sub from Traccar           │
│                                                                 │
│  TimescaleDB (gps_points hypertable)                            │
│  Redis (leaderboard sorted sets + pub/sub)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Milestone 2 Features

```bash
# Run all backend tests
docker compose exec backend pytest -q

# Test specifically the anti-cheat pipeline
docker compose exec backend pytest activities/tests.py -v -k "anomaly or vmax"

# Test plugin system
docker compose exec backend pytest events/tests.py -v -k "Plugin"

# Trigger manual leaderboard recalculation
docker compose exec backend python manage.py shell -c "
from activities.tasks import recalculate_city_leaderboard
recalculate_city_leaderboard('siedlce')
print('done')
"

# Check Redis leaderboard state
docker compose exec redis redis-cli ZREVRANGE leaderboard:city:siedlce 0 9 WITHSCORES
```

---

*Next: Milestone 3 — MapLibre route display, Detox E2E tests, EAS Build CI*
