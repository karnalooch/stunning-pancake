# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/RAILWAY_KUBERNETES.md) |
| **translation_status** | machine-translated |
| **canonical_path** | docs/en/operations/RAILWAY_KUBERNETES.md |
---

**Status:** ✅ Active  
**Last update:** 2026-06-03  
**Context:** production on Railway (Docker + `railway.json`), manifests in `infrastructure/k8s/`.  
**Related:** [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md) · [RAILWAY_PRODUCTION_CHECKLIST.md](./RAILWAY_PRODUCTION_CHECKLIST.md)

---

## TL;DR - reply to "Kubernets on Railway"

| Question | Reply |
|---------|-----------|
| Does Railway host **managed Kubernetes** (EKS/GKE‑like)? | **No.** Railway to PaaS: Docker services, managed databases, internal network `*.railway.internal`. |
| Is there a beta for "Railway K8s"? | **No official offer** (2025/2026). Railway publicly describes itself as a platform *without* K8s/Helm/Terraform for typical teams. |
| What to do **today** at the Railway production? | **Option B** - Native Railway scaling + manifests as future target. |
| When **Option A** (real cluster)? | When you need HPA on multiple nodes, your own ingress/controller, multi-region compute, BYOC - then **GKE / k3s / other managed K8s** and Postgres/Redis can stay on Railway or migrate together. |

The manifests in the repository **do not break** the current Railway deployment - they are additive. This document describes the migration mapping and checklist.

---

## 1) What Railway actually offers

Railway launches **containers** from the repository:

- `backend/railway.json`, `admin/railway.json`, `celery-worker/railway.json`, `celery-worker-simulation/railway.json`, `celery-worker-routing/railway.json`, `telemetry/railway.json`, `infrastructure/brouter/railway.json`
- Build: **Dockerfile** (or Nixpacks)
- Scaling: **Replicas** on the website, **RAM/CPU** in Settings → Resources, variables in **Variables**
- Network: public URL + private `http://<service>.railway.internal:<port>`
- Databases: **PostgreSQL**, **Redis** as separate plugins (variables `DATABASE_URL`, `REDIS_URL`)

This is **not** a Kubernetes cluster. You are not applying `kubectl apply` to Railway - Railway does not expose the Kubernetes API.

---

## 2) Target architectures

### Option B (recommended **now**) - Railway-native

Stay on Railway for **compute**, use manifests as **documentation/future** target.```mermaid
flowchart LR
  subgraph Railway["Railway Project"]
    API[backend]
    ADM[admin]
    CW[celery-worker]
    CWS[celery-worker-simulation]
    CWR[celery-worker-routing]
    BR[brouter]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end
  API --> PG
  API --> RD
  CW --> RD
  CWS --> RD
  CWS --> BR
  CWR --> BR
  API --> BR
```**What to click/set today (Dashboard):**

1. **Project** → linked GitHub repo, branch `main`, auto-deploy enabled.
2. **Services** (each with proper root / `railway.json`):
   - `backend` - root `backend/` or Dockerfile from repo
   - `admin` - root `admin/`
   - `celery-worker` - Dockerfile `celery-worker/`
   - `celery-worker-simulation` - Dockerfile `celery-worker-simulation/`
   - `brouter` - `infrastructure/brouter/Dockerfile`, segment volume
3. **PostgreSQL + Redis** - Add Database; connect `${{Postgres.DATABASE_URL}}` references to Django/Celery services.
4. **Variables** - copy from the `infrastructure/k8s/config/railway-to-k8s.env.template` template (sections per service).
5. **Resources** - simulation worker **≥ 2 GB RAM**; see [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).
6. **Replicas** - for large live sim: second replica of `celery-worker-simulation` instead of `CONCURRENCY=8` on small RAM.
7. **Networking** - `BROUTER_URL=http://brouter.railway.internal:17777/brouter` on backend + simulation workers.
8. **Custom domain** - Settings → Domains on backend/admin; update `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, redirect OAuth URI.

Worker details: [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md), [DEPLOYMENT.md](../DEPLOYMENT.md).

### Option A - True Kubernetes (non-Railway compute)

Compute on **GKE / DigitalOcean K8s / k3s (Hetzner, OVH, own VPS)**. Optional data:

- **A1:** Postgres + Redis still on Railway (only `DATABASE_URL` / `REDIS_URL` in Secret k8s) - fast start, single-region.
- **A2:** Full DB migration to Cloud SQL / managed Postgres on K8s Cloud - less dependency on Railway.```mermaid
flowchart LR
  subgraph K8s["Klaster K8s (GKE / k3s)"]
    API[sport-backend-api]
    W[sport-celery-worker]
    WS[sport-celery-worker-simulation]
    BT[sport-celery-beat]
    BR[sport-brouter]
    R[sport-redis]
  end
  subgraph RailwayData["Opcjonalnie Railway"]
    PG[(PostgreSQL)]
  end
  API --> PG
  API --> R
  W --> R
```Runbook apply: [KUBERNETES.md](./KUBERNETES.md).

### Option C - "Railway K8s beta"

**N/A** - No product to document. If Railway ever announces K8s, this document should be updated; until then, treat **Option B** as your source of truth for production.

---

## 3) Mapping: Railway website ↔ K8s manifest

| Railway (service) | K8s Deployment | Notes |
|------------------|----------------|-------|
| `backend` | `sport-backend-api` | Gunicorn, health `/api/infra/health/` |
| `celery-worker` | `sport-celery-worker` | `critical,default,notifications` queues |
| `celery-worker-simulation` | `sport-celery-worker-simulation` | `simulation` queue |
| *(no separate website)* | `sport-celery-beat` | On Railway Beat, often in the same image as the worker - in k8s, a separate Deployment |
| `brouter` | `sport-brouter` | PVC for tiles in k8s; on Railway **Volume** |
| Redis plugin | `sport-redis` | In k8s in-cluster; on Railway **managed Redis** |
| PostgreSQL plugin | *(external)* | In k8s `DATABASE_URL` in Secret, not `optional/postgres` |

Variables: template **`infrastructure/k8s/config/railway-to-k8s.env.template`** - same keys as `app-configmap.yaml` + `app-secrets.template.yaml`, with comments which Railway service sets them.

---

## 4) Railway → k3s / GKE migration checklist

Use when planning to exit Railway **compute** (bases can be transferred in a separate step).

### Phase 0 - Preparation

- [ ] Account and cluster (e.g. GKE Autopilot or k3s on 2+ VMs)
- [ ] `kubectl`, `metrics-server`, ingress controller (nginx / traefik)
- [ ] Image registry: GHCR (`ghcr.io/<org>/sport-backend:latest` etc.) - build from the same Dockerfiles as Railway
- [ ] Copy production variables from Railway Variables → fill in `app-secrets` + `app-configmap` (see env template)

### Phase 1 - Data (highest risk)

- [ ] Snapshot Postgres (Railway → backup → restore in target database **or** logical dump `pg_dump`)
- [ ] Maintenance window; set `MAINTENANCE_MODE` if you have the flag
- [ ] New `DATABASE_URL` in Secret k8s; test connection to job migrate

### Phase 2 - Redis / BRouter

- [ ] Redis: managed in the cloud **or** `kubectl apply -f workloads/redis.yaml`
- [ ] BRouter: PVC + import Polish tiles (like [BROUTER.md](./BROUTER.md))
- [ ] `BROUTER_URL` in ConfigMap points to Service k8s

### Phase 3 - Application (sequence from KUBERNETES.md)```bash
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/config/app-configmap.yaml
# Sekrety: wygeneruj z railway-to-k8s.env.template, NIE commituj wartości
kubectl apply -f infrastructure/k8s/config/app-secrets.yaml   # lokalny plik, .gitignore
kubectl apply -f infrastructure/k8s/workloads/redis.yaml      # jeśli in-cluster
kubectl apply -f infrastructure/k8s/workloads/brouter.yaml
kubectl apply -f infrastructure/k8s/jobs/migrate-job.yaml
kubectl wait --for=condition=complete job/sport-backend-migrate -n sport --timeout=300s
kubectl apply -f infrastructure/k8s/workloads/api.yaml
kubectl apply -f infrastructure/k8s/workloads/worker.yaml
kubectl apply -f infrastructure/k8s/workloads/worker-simulation.yaml
kubectl apply -f infrastructure/k8s/workloads/beat.yaml
kubectl apply -f infrastructure/k8s/policy/
kubectl apply -f infrastructure/k8s/network/ingress.yaml
```### Phase 4 - Traffic Switch

- [ ] DNS: `api.<domain>` → Ingress LB
- [ ] `ALLOWED_HOSTS`, TLS cert (cert-manager)
- [ ] Smoke: health, admin login, one live sim tick
- [ ] Disable auto-deploy Railway **only after** stable k8s (compute services can be deleted; leave DB until replication)

### Phase 5 - Rollback

- [ ] Keep DB snapshot and previous Railway deployment (Rollback in Dashboard)
- [ ] `kubectl rollout undo deployment/sport-backend-api -n sport`

---

## 5) Scaling on Railway (without K8s) - "what to set today"

| Purpose | Where in Railway | Action |
|-----|-----------------|-------|
| More throughput API | `backend` → Settings → **Replicas** or higher CPU plan | 2+ replicas behind the Railway load balancer |
| The queue is growing | `celery-worker` → Replicas / `CELERY_WORKER_CONCURRENCY` | See [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| Live sim / 300k | `celery-worker-simulation` | `CELERY_WORKER_POOL=solo`, caps `SCALE_*`, RAM ≥ 2 GB, optionally **Replicas=2** |
| OOM SIGKILL | Same website → **Resources** | Reduce concurrency or increase RAM |
| BRouter timeout | `brouter` volume + health | [BROUTER.md](./BROUTER.md) |

The variables in `celery-worker-simulation/railway.json` are already set as a safe baseline - **do not override** them with a higher `CELERY_WORKER_CONCURRENCY` without increasing RAM.

---

## 6) Files in the repository

| File | Role |
|------|------|
| `infrastructure/k8s/` | Production manifests (target k8s) |
| `infrastructure/k8s/config/railway-to-k8s.env.template` | Railway env mapping ↔ ConfigMap/Secret |
| `docs/operations/KUBERNETES.md` | Runbook `kubectl apply` |
| `docs/operations/RAILWAY_CELERY_MEMORY.md` | Tuning workers on Railway |
| `scripts/ops/check-railway-k8s-env-parity.ps1` | Compare keys with template (local) |

---

## 7) FAQ

**Can I upload `infrastructure/k8s` to Railway?**  
No - Railway does not run manifests. You can keep them in a repo and apply on an external cluster.

**Is it worth migrating to K8s?**  
Only if you need platform control (HPA custom, multi-cluster, compliance). For one product on Railway **Option B** is operationally cheaper.

**Postgres stays on Railway with k8s API?**  
Yes (A1) - set `DATABASE_URL` in Secret to Railway URL (enable SSL if required). Beware of cross-cloud latency.

---

## Related documents

- [KUBERNETES.md](./KUBERNETES.md)
- [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)
- [RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [DEPLOYMENT.md](../DEPLOYMENT.md)
