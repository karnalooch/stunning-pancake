# Railway production checklist — marvelous-gratitude

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Platform Operator |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/RAILWAY_PRODUCTION_CHECKLIST.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/RAILWAY_PRODUCTION_CHECKLIST.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Last updated** | 2026-06-03 |
| **Goal** | Verify production Celery workers (simulation + routing) before a load test or after deploy. |
| **Audience** | Platform Operator |
| **SSOT memory / caps** | [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| **Runbook index** | [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md) |

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Railway CLI | `npm i -g @railway/cli` |
| `RAILWAY_API_TOKEN` | Windows **User** environment (Cursor/agent after IDE restart). **Do not** commit. Remove legacy `RAILWAY_TOKEN`. |
| Project | `marvelous-gratitude` / `production` |
| Optional local | `.env.railway.local.example` → `.env.railway.local` (gitignored) |

---

## Procedure

### 1. Prepare the CLI (Platform Operator)

1. Ensure `RAILWAY_API_TOKEN` is in User env (not in the repo).
2. From the repo root:

   ```powershell
   railway link --project marvelous-gratitude --environment production
   ```

### 2. Automated verification (Platform Operator)

1. Run:

   ```powershell
   .\scripts\railway-verify-production.ps1
   ```

2. **PASS:** message `PASS: all checks`.
3. The script checks, among other things:
   - presence of `RAILWAY_API_TOKEN` (value not printed),
   - repo `karnalooch/stunning-pancake` on `celery-worker-routing` and `celery-worker-simulation`,
   - variables from `railway.json` (queues, `solo`, `SCALE_SIM_ASYNC_ROUTING`),
   - routing logs — **no** Expo/Metro,
   - optional GraphQL: `dockerfilePath`, `railwayConfigFile`, `source.repo` for routing.

### 3. Services — source of truth (Platform Operator)

| Service | Repo | Dockerfile | Config as code |
|---------|------|------------|----------------|
| `celery-worker-simulation` | `karnalooch/stunning-pancake` | `/celery-worker-simulation/Dockerfile` | `celery-worker-simulation/railway.json` |
| `celery-worker-routing` | **same repo** | **same Dockerfile** | `celery-worker-routing/railway.json` |
| `celery-worker` | same repo | `celery-worker/Dockerfile` | `celery-worker/railway.json` |

**Routing:** without repo + Dockerfile Railway runs Railpack (e.g. Expo from `mobile/`). Set in Dashboard or GraphQL `serviceInstanceUpdate`: `rootDirectory=/`, `railwayConfigFile`, `dockerfilePath` — details: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) § Config as code.

### 4. Variables — simulation (Platform Operator)

Copy from backend: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `DEBUG=0` (values only in Railway Variables).

Baseline from `celery-worker-simulation/railway.json` (do not raise without RAM):

- `CELERY_WORKER_QUEUES=simulation`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `SCALE_MAX_STARTS_PER_LIVE_TICK=30`
- `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK=25`
- `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS=4`

### 5. Variables — routing (Platform Operator)

Same `DATABASE_URL`, `REDIS_URL`, **`SECRET_KEY`** as simulation/backend.

- `CELERY_WORKER_QUEUES=routing`
- `CELERY_WORKER_HOSTNAME=routing@%h`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `BROUTER_URL=http://brouter.railway.internal:17777/brouter`

### 6. RAM — Railway Dashboard only (Platform Operator)

| Service | Minimum |
|---------|---------|
| `celery-worker-simulation` | **≥ 2 GB** |
| `celery-worker-routing` | **≥ 1 GB** |
| `brouter` | [BROUTER.md](./BROUTER.md) |

RAM is **not** verified by the PowerShell script (not in CLI); set manually under Settings → Resources. Full table: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

### 7. Deploy routing (Platform Operator)

```powershell
railway service link celery-worker-routing
railway up -s celery-worker-routing -e production --detach -m "celery routing worker"
```

### 8. Verify logs (Platform Operator)

```powershell
railway logs -s celery-worker-routing --lines 50
```

| Result | Expected |
|--------|----------|
| **PASS** | `Starting Celery … routing@`, `queues=routing`, no `expo start` / Metro |
| **FAIL** | Expo, `4velo@`, Metro — wrong build/repo |

```powershell
railway logs -s celery-worker-simulation --lines 30
```

| Result | Expected |
|--------|----------|
| **PASS** | `simulation@`, `pool=solo`, `concurrency=1` (solo) or consistent with prefork |

---

## Rollback (Platform Operator)

| Step | Action |
|------|--------|
| 1 | Railway → service → **Deployments** → restore previous deployment |
| 2 | On OOM: lower `SCALE_MAX_STARTS_PER_LIVE_TICK` and `SCALE_SIM_BROUTER_*` — [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| 3 | Stuck live sim: `POST /api/activities/admin/simulator-reset/` or admin **Reset simulator locks** — [SIMULATOR.md](./SIMULATOR.md) |
| 4 | Emergency async routing bypass: `SCALE_SIM_ASYNC_ROUTING=0` (higher tick load — emergency only) |

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Script: routing repo FAIL | GitHub not linked | Dashboard: repo `karnalooch/stunning-pancake` + Dockerfile |
| Logs: Expo / Metro | Railpack from `mobile/` | Set `dockerfilePath` + `railwayConfigFile` |
| `ride_warming` > 0 for long | No `routing` consumer | Deploy `celery-worker-routing`, check logs |
| SIGKILL in logs | OOM | RAM ≥ 2 GB simulation; `solo`; see RAILWAY_CELERY_MEMORY |
| GraphQL check FAIL | Token or service ID | `RAILWAY_API_TOKEN`; manual Dashboard check |

---

## Related

- [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)
- [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [SIMULATOR.md](./SIMULATOR.md)
- [../../admin/P1_ROADMAP.md](../../admin/P1_ROADMAP.md) — Package 1a/1b
- [../../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md)
