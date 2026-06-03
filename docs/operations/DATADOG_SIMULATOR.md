# Datadog — simulator routing logs (Paczka 1b)

| | |
|--|--|
| **Status** | ✅ Active (log keys only — no DD SDK in app) |
| **Owner role** | Platform Operator |
| **Runbook** | [SIMULATOR.md](./SIMULATOR.md) |

Structured logs are emitted from `activities.simulator_routing_backpressure` and live tick routing. Filter in Datadog Logs (or Railway log search) by message substring or JSON fields.

## `sim.routing.backpressure`

Emitted when routing dispatches are skipped or capped due to queue depth (rate-limited ~60s per live sim).

| Field | Meaning |
|-------|---------|
| `routing_queue_depth` | `max(FSM warming, Celery LLEN routing)` |
| `max_routing_queue_depth` | Env `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` when set |
| `routing_backpressure_active` | Depth ≥ cap |
| `dispatches_skipped` | Starts not queued this tick |

**Query example:** `@message:"sim.routing.backpressure" OR message:"sim.routing.backpressure"`

## `sim.routing.unroutable`

BRouter could not produce a road path for a start (island / no pass). Increments `routing_unroutable_total` on live state.

**Query example:** `sim.routing.unroutable`

## Related

| Key | Source |
|-----|--------|
| `sim.routing.error` | Transport / gateway failures |
| Live sim API | `routing_queue_depth`, `routing_backpressure_active`, `dispatches_throttled` on `GET /api/activities/admin/live-simulate/` |
| Dashboard | `sim_kpi` in `GET /api/activities/admin/stats/` |

No application Datadog tracer is required for Paczka 1b; use log-based monitors if needed.
