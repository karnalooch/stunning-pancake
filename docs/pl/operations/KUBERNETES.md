# Kubernetes Runbook — SPORT Platform


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/KUBERNETES.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/KUBERNETES.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | DevOps |
| **Last reviewed** | 2026-06-03 |
| **Audience** | DevOps |

> **Produkcja na Railway?** Railway nie uruchamia tych manifestów — [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md).

Production-ready, pragmatic baseline for deploying:
- Django backend API
- Celery workers (default + simulation)
- Celery Beat
- Redis
- BRouter
- Optional admin static frontend

PostgreSQL is treated as an external managed dependency by default.

---

## 1) Manifest location and structure

Path: `infrastructure/k8s/`

- `namespace.yaml` — namespace bootstrap
- `config/` — ConfigMap + Secret template
- `workloads/` — Deployments/StatefulSets/Services
- `policy/` — HPA + PDB
- `network/` — Ingress
- `jobs/` — one-off migration job
- `optional/` — optional local PostgreSQL manifest

---

## 2) Required secrets and configuration

Before first deployment, copy and edit:

1. `infrastructure/k8s/config/app-secrets.template.yaml` (or map from `railway-to-k8s.env.template` if migrating from Railway Variables)
2. Replace at least:
   - `SECRET_KEY`
   - `DATABASE_URL` (external PostgreSQL)
3. Optionally set integrations (`SENTRY_DSN`, Stripe, email, Matrix).

Also update `infrastructure/k8s/config/app-configmap.yaml`:
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- ingress domains (`api.example.com`, `admin.example.com`)
- image references in workload manifests (`ghcr.io/your-org/...`)

---

## 3) Apply order (exact)

Run from repo root:

```bash
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/config/app-configmap.yaml
kubectl apply -f infrastructure/k8s/config/app-secrets.template.yaml
kubectl apply -f infrastructure/k8s/workloads/redis.yaml
kubectl apply -f infrastructure/k8s/workloads/brouter.yaml
kubectl apply -f infrastructure/k8s/jobs/migrate-job.yaml
kubectl wait --for=condition=complete job/sport-backend-migrate -n sport --timeout=300s
kubectl apply -f infrastructure/k8s/workloads/api.yaml
kubectl apply -f infrastructure/k8s/workloads/worker.yaml
kubectl apply -f infrastructure/k8s/workloads/worker-simulation.yaml
kubectl apply -f infrastructure/k8s/workloads/beat.yaml
kubectl apply -f infrastructure/k8s/policy/pdb.yaml
kubectl apply -f infrastructure/k8s/policy/hpa.yaml
kubectl apply -f infrastructure/k8s/network/ingress.yaml
```

Optional admin:

```bash
kubectl apply -f infrastructure/k8s/workloads/admin.optional.yaml
```

Optional local PostgreSQL (not recommended for production):

```bash
kubectl apply -f infrastructure/k8s/optional/postgres.optional.yaml
```

---

## 4) Scaling knobs

Primary scaling controls:

- API:
  - `workloads/api.yaml` -> `spec.replicas`
  - `policy/hpa.yaml` -> min/max/CPU target for `sport-backend-api`
- Default workers:
  - `workloads/worker.yaml` -> `spec.replicas`
  - `policy/hpa.yaml` -> min/max/CPU target for `sport-celery-worker`
- Simulation workers:
  - `workloads/worker-simulation.yaml` -> `spec.replicas`
  - `policy/hpa.yaml` -> min/max/CPU target for `sport-celery-worker-simulation`
- Worker concurrency and queue split:
  - `config/app-configmap.yaml`
  - `CELERY_WORKER_*_CONCURRENCY`
  - `CELERY_WORKER_*_QUEUES`

Queue isolation recommendation:
- Default worker (`critical,default,notifications`) for user-facing and routine tasks.
- Simulation worker (`simulation`) isolated from user-facing queues.
- Keep dedicated queues reserved for `routing` and `wipe` for further split-out workers when traffic grows.

---

## 5) Observability hooks

- Probes:
  - API: HTTP liveness/readiness on `/api/infra/health/`
  - Worker/Beat: process presence probes via `pgrep`
  - Redis/BRouter: TCP probes
- Metrics:
  - HPAs consume CPU metrics (`metrics-server` required).
- Logs:
  - `kubectl logs deployment/sport-backend-api -n sport`
  - `kubectl logs deployment/sport-celery-worker -n sport`
  - `kubectl logs deployment/sport-celery-worker-simulation -n sport`
  - `kubectl logs deployment/sport-celery-beat -n sport`

---

## 6) Rollout, rollback, and restart

Check rollout:

```bash
kubectl rollout status deployment/sport-backend-api -n sport
kubectl rollout status deployment/sport-celery-worker -n sport
kubectl rollout status deployment/sport-celery-worker-simulation -n sport
kubectl rollout status deployment/sport-celery-beat -n sport
```

Rollback:

```bash
kubectl rollout undo deployment/sport-backend-api -n sport
kubectl rollout undo deployment/sport-celery-worker -n sport
kubectl rollout undo deployment/sport-celery-worker-simulation -n sport
kubectl rollout undo deployment/sport-celery-beat -n sport
```

Force restart after ConfigMap/Secret change:

```bash
kubectl rollout restart deployment/sport-backend-api -n sport
kubectl rollout restart deployment/sport-celery-worker -n sport
kubectl rollout restart deployment/sport-celery-worker-simulation -n sport
kubectl rollout restart deployment/sport-celery-beat -n sport
```

---

## 7) Common failure playbook

### A) API pods CrashLoopBackOff
- Check env/secret mismatch:
  - `kubectl describe pod <pod> -n sport`
- Validate DB connectivity from `DATABASE_URL`.
- Re-run migration job:
  - `kubectl delete job sport-backend-migrate -n sport`
  - `kubectl apply -f infrastructure/k8s/jobs/migrate-job.yaml`

### B) Worker backlog growing
- Scale workers quickly:
  - `kubectl scale deployment/sport-celery-worker -n sport --replicas=6`
  - `kubectl scale deployment/sport-celery-worker-simulation -n sport --replicas=3`
- Increase per-process concurrency in `app-configmap.yaml`.
- Split heavy queues (`routing`, `wipe`) into dedicated deployments.

### C) BRouter slow/unavailable
- Verify PVC is bound and tiles are present.
- Check pod logs for tile download/lookup mismatch.
- Temporarily lower simulation load (replicas/concurrency).

### D) HPA not scaling
- Ensure `metrics-server` is installed.
- Check:
  - `kubectl describe hpa sport-backend-api -n sport`
  - `kubectl top pods -n sport`

### E) Ingress returns 404/502
- Verify ingress class and controller match.
- Validate service endpoints:
  - `kubectl get endpoints -n sport`
- Confirm DNS points to ingress load balancer.

---

## 8) Local dev (Skaffold / Kind / dev.ps1)

Canonical production manifests: `infrastructure/k8s/`. For local clusters use the **local overlay**:

```bash
kubectl apply -k infrastructure/k8s/overlays/local
# or
skaffold dev   # uses infrastructure/k8s/overlays/local via skaffold.yaml
```

The overlay enables optional admin + postgres + telemetry + traccar workloads and patches images to `localhost/sport-backend` / `localhost/sport-owner` (`gold-master-v2.1` tag). Legacy path `infrastructure/kubernetes/base/` is deprecated.

---

## 9) Validation

Recommended pre-apply checks:

```bash
kubectl apply --dry-run=client -k infrastructure/k8s
kubectl kustomize infrastructure/k8s
```

If `kubectl` is unavailable in local environment, validate YAML in CI with a schema-aware validator (for example `kubeconform` or `kubeval`) before production apply.
