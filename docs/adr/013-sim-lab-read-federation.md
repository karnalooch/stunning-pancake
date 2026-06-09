# ADR-013: Sim-lab read federation (prod BFF → isolated data plane)


| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-09 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |
| **Epic** | [docs/todo/sim-lab-read-federation.md](../todo/sim-lab-read-federation.md) |
| **Related** | [ADR-010](./010-simulator-redis-celery.md), [infrastructure/sim-lab/README.md](../../infrastructure/sim-lab/README.md) |

---

## Context

Sim-lab is an isolated load-test environment (separate Postgres, Redis, Celery, telemetry). Production admin talks to the production backend URL (`VITE_API_URL`).

`SIM_LAB_PROXY` (ADR-010 follow-up) forwards **simulator commands** and **live map telemetry** from prod backend to sim-lab. Dashboard KPIs (`GET /activities/admin/stats/`) and `sim_kpi` still read production Postgres/Redis. Operators running a 20k-user simulation on sim-lab see an empty or stale dashboard on prod admin.

We need prod UI to display synthetic data for load tests and operator demos **without** replicating users into production databases.

## Decision

1. **Keep sim-lab as the sole write path** for synthetic users, activities, and telemetry. Never replicate sim-lab rows into prod Postgres.

2. **Extend prod backend as a read federation BFF** when `SIM_LAB_READ_FEDERATION_ENABLED=1` (requires `SIM_LAB_PROXY_ENABLED=1`):
   - Proxy `GET /activities/admin/stats/` to sim-lab (Phase 1).
   - Phase 2 (planned): `admin/all`, `analytics/*` — see [todo epic](../todo/sim-lab-read-federation.md).

3. **Standard response contract** for federated payloads:
   - `data_source`: `"production"` | `"sim-lab"`
   - `synthetic`: `true` when data comes from the simulator
   - `sim_lab_proxy`: `true` (backward compatible)
   - `sim_lab_label`: public label from env

4. **Admin UI** shows a persistent banner when `dashboard_data_source === "sim-lab"` (from `GET /activities/admin/sim-target/`).

5. **Sales / customer demos** use a **separate demo environment** ([demo-environment.md](../todo/demo-environment.md)), not prod admin with federation.

## Consequences

### Positive

- Prod Postgres/Celery remain isolated under heavy simulation.
- Operators use the real prod admin URL for load-test visibility.
- Clear synthetic-data labeling reduces operational mistakes.

### Negative / trade-offs

- `admin/stats` proxy adds latency (mitigated: `SIM_LAB_PROXY_STATS_TIMEOUT`, optional cache TTL).
- Federated stats can be briefly stale vs live map (acceptable for KPI cards).
- Phase 1 does not federate activity lists or analytics — documented as Phase 2.

## Non-goals

- Replicating sim-lab DB to prod
- Federating mutating endpoints beyond existing sim proxy
- Federating `users/all`, RBAC, audit log, export, impersonate
- Using prod federation for external sales demos

## Anti-patterns

| Pattern | Why avoid |
|---------|-----------|
| Copy synthetic users to prod | Contaminates business metrics and RBAC |
| Hide `synthetic: true` in UI | Wrong operational decisions |
| Sales demo on prod + federation | Confuses customers; risks prod coupling |
| Proxy all admin GETs blindly | RBAC and destructive paths cross environments |

## Implementation references

- `backend/activities/sim_lab_proxy.py` — `sim_lab_read_federation_enabled()`, `try_forward_sim_lab_read()`, `annotate_federated_payload()`
- `backend/activities/admin_views.py` — `AdminDashboardStatsView`, `SimTargetView`
- `admin/src/hooks/useSimDataSource.ts`, `DataSourceBanner.tsx`
- `infrastructure/sim-lab/scripts/setup-sim-lab-proxy.ps1`
