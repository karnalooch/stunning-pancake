# Admin Performance Audit — 2026-06-07

| | |
|--|--|
| **Status** | Active |
| **Environment** | Prod main — `admin-production-083b.up.railway.app` / `backend-production-55c7.up.railway.app` |
| **Role** | `GLOBAL_OWNER` |
| **Scripts** | `admin/scripts/audit-admin-perf.mjs`, `admin/scripts/audit-admin-full.mjs` |

## How to re-run

```bash
cd admin
ADMIN_PASS='***' node scripts/audit-admin-perf.mjs
ADMIN_PASS='***' node scripts/audit-admin-full.mjs
```

Reports: `admin/audit-screenshots/perf-audit-*.json`, `admin/audit-screenshots/audit-report.json`

---

## Route verdict matrix (code review + prior prod snapshots)

| Route / area | Primary API | Verdict | Action taken |
|--------------|-------------|---------|--------------|
| Dashboard (GLOBAL_OWNER) | `/activities/admin/stats/`, `/ai/insights/`, telemetry | optimize + loading | Boot overlay, deferred widgets, lazy chunks |
| System Intelligence | `/activities/ai/insights/` | **optimize** | Reads cached admin stats (no 3× COUNT) |
| Department Analytics | `/activities/analytics/department/` | **optimize** | GROUP BY + Redis 120s |
| Admin stats per-tenant | `/activities/admin/stats/` | **optimize** | GROUP BY tenant_id + users |
| Live Map | `/telemetry/live/` | loading | Existing overlay; deferred from dashboard |
| Activity Timeline | `/activities/sessions/` | loading | Lazy + skeleton |
| Audit Log | `/users/audit-log/` | loading | Lazy + skeleton |
| Trend / System Health | `/analytics/`, `/infra/health/` | ok / loading | Lazy + skeleton |
| City Analytics | `/activities/admin/stats/` | loading | RouteLoadingCard + KPI skeleton |
| Departments | `/users/departments/`, tree | loading | Table/tree skeleton |
| Department Users | dept endpoints | loading | Row skeleton |
| Settings MFA | `/users/mfa/status/` | loading | Security section skeleton |
| Sponsor Dashboard | `/rewards/sponsor-stats/` | loading | Stat skeletons |
| Users / Activities | paginated APIs | ok | Already paginated |
| Export statistics | export endpoint | optimize | Reuses stats cache |
| Telemetry anomalies | `/telemetry/anomalies/` | optimize | `select_related("user")` |

---

## Classification rules

1. **optimize** — duplicate full-table scans, N+1 loops, or missing cache where a cheap aggregate exists
2. **loading** — inherently slow or large payloads; UX must show staged/skeleton/boot state
3. **ok** — paginated, cached, or sub-800ms warm path

---

## Out of scope (this pass)

- Live Map SSE full-snapshot refresh (needs delta events)
- `city_rankings_mv` Celery refresh every 5 min (background ops)
- City Analytics chart API (charts remain sample data with badge)

---

## Post-deploy verification checklist

- [ ] `audit-admin-perf.mjs`: warm `ai/insights` and `analytics/department` p95 &lt; 200ms
- [ ] `audit-admin-full.mjs`: no `loading_gap` on departments, settings, sponsor
- [ ] Manual: Dashboard cold `?refresh=1` shows boot overlay then KPI fade-in
