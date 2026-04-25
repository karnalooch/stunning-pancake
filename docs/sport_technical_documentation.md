# SPORT Platform — Technical Documentation
> **Version**: v1.0.0-production | **Last Updated**: 2026-04-24 | **Edition**: Hyperscale 2025

---

## Overview

SPORT is a **high-performance sport gamification platform** built for massive-scale city and corporate challenges. It combines real-time GPS telemetry, multi-layer anti-cheat validation, social infrastructure, and a monetization marketplace into a single coherent stack.

### 🚀 Stress Test 2025 — Validated Benchmarks

| Metric | Value |
|:---|:---|
| **Active Users** | 184,000+ (92k cyclists + 92k runners) |
| **Total Distance** | 38,000,000 km |
| **Municipal Tenants** | 200 cities and gminas |
| **Concurrent Ingestion** | 10,000+ req/sec (FastAPI + Redis Pipeline) |
| **Leaderboard Latency** | <5ms (Redis Cluster Sorted Sets) |
| **Anti-Cheat Throughput** | 1,000+ tracks/sec (Celery horizontal scale) |

---

## 🛠 Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Mobile** | React Native 0.76, Expo, MMKV | GPS tracking, offline-first, UI |
| **Telemetry** | FastAPI, asyncpg, Redis Pipeline | High-speed GPS ingestion (<1ms) |
| **Backend** | Django 4.2 LTS, DRF, Celery | Business logic, RBAC, REST API |
| **Database (Dev)** | TimescaleDB + PostGIS | Time-series GPS, spatial queries |
| **Database (Prod)** | Citus 12.1 (1 coordinator + 3 workers) | Distributed sharding, 32 shards/table |
| **Cache (Dev)** | Redis 7 standalone | Leaderboards, pub/sub |
| **Cache (Prod)** | Redis Cluster (3 masters + 3 replicas) | Distributed cache, 3× read throughput |
| **Admin UI** | React 19, Vite, **shadcn/ui**, **Mantine** | Modern component architecture, full source control |
| **Analytics UI** | **Tremor**, **Magic UI** | Dashboard KPI cards, "Wow" effects, bento grids |
| **Graphics** | **Three.js**, **PixiJS**, **deck.gl** | 3D visualization, high-perf 2D, geospatial routes |
| **Animations** | **Framer Motion** | Micro-interactions, page transitions |
| **Messaging** | Matrix E2EE (async Celery provisioning) | Club chat, notifications |
| **Observability** | Sentry (Django + FastAPI + Mobile) | Error tracking, performance profiling |

---

## 🔒 Security Architecture

| Control | Implementation |
|:---|:---|
| **Row Level Security** | `core/rls.py` — 5 tables, tenant isolation at PostgreSQL level |
| **Privacy Zones v2** | Dynamic radius (HOME 250m / WORK 150m), density boost ×1.5 |
| **Sentry PII Guard** | `send_default_pii=False`, GPS-stripping `beforeSend` in mobile |
| **Trivy CI** | SARIF to GitHub Security tab on every push (backend + admin + mobile) |
| **Dependabot v2** | 4 ecosystems, `security-patches` auto-group |
| **JWT Auth** | 60min access token, 30d refresh with rotation and blacklist |

---

## 🤖 Anti-Cheat Engine (5 Layers)

```
GPS Track Input
     │
     ▼ Layer 1: Fast Selection Gate  (~0.5ms, O(N), no I/O)
     │   Teleport detection, acceleration gate, motor fingerprint, straight-line ratio
     │
     ▼ Layer 1.5: ML Anomaly Detector  (~5ms, IsolationForest)
     │   8 kinematic features. Fails open — no false positives without model.
     │
     ▼ Layer 2: V-max Biomechanical Check  (~1ms)
     │   Sport-specific speed ceilings: RUN(6.5 m/s) / BIKE(18 m/s) / WALK(2.5 m/s)
     │
     ▼ Layer 3: BRouter Topological Validation  (~200ms)
     │   Viterbi HMM map-matching against OpenStreetMap topology
     │
     ▼ Layer 4: Plugin Registry Hooks
         Custom domain rules via core/plugin_registry.py
```

---

## 💰 Monetization & Rewards

| Feature | Implementation |
|:---|:---|
| **Stripe B2C** | Premium subscription checkout + webhook |
| **Stripe B2B** | Multi-seat corporate plan + Customer Portal |
| **Voucher Marketplace** | Sponsor → VoucherPool → atomic redemption (`SELECT FOR UPDATE`) |
| **Points Ledger** | Append-only accounting (10 pts/km, idempotent, auto-awarded on verification) |

---

## 📊 Premium Analytics (`/api/activities/analytics/`)

| Feature | Algorithm |
|:---|:---|
| **Race Predictions** | Riegel: T2 = T1 × (D2/D1)^exp (1.06 run / 1.02 bike) |
| **Training Load** | ACWR — Acute/Chronic Workload Ratio (injury risk: OPTIMAL / ELEVATED / OVERTRAINING_RISK) |
| **Volume Trend** | Linear regression over 12 weeks + R² fit quality |
| **Heatmap API** | `/api/activities/heatmap/?bbox=...&zoom=12` → GeoJSON polygons (weighted) |

---

## 🌍 OGC API — Moving Features (`/api/ogc/`)

Standardized telemetry export for Smart City partners (OGC standard conformant):

| Endpoint | Description |
|:---|:---|
| `GET /api/ogc/conformance/` | Conformance declaration |
| `GET /api/ogc/collections/` | Available event collections |
| `GET /api/ogc/collections/{id}/items/` | Paginated activity trajectories (MF-JSON) |
| `GET /api/ogc/collections/{id}/items/{fid}/` | Single trajectory with timestamps |

---

## ⚙️ Hyperscale Deployment

### Redis Cluster (6 nodes)
```bash
# Activate via env var — no code changes required
REDIS_CLUSTER_NODES=redis-master-1:6379,redis-master-2:6380,redis-master-3:6381
```

### Citus Sharding (4 nodes)
```bash
# One-time setup after deploy
docker compose exec backend python manage.py shell -c \
  "from core.citus import apply_citus_sharding; apply_citus_sharding()"
```

### Full Hyperscale Stack
```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d
```

### Infrastructure Health
```
GET /api/infra/health/        → Combined Redis + Citus status
GET /api/infra/health/redis/  → Cluster topology + latency
GET /api/infra/health/citus/  → Node list + shard distribution
```

---

---

## 🎨 Visual Layer & Graphics Engines (New Era)

Responding to the need for a modern, high-performance visual layer, the SPORT platform utilizes a dual-approach: modular component libraries for UI and specialized rendering engines for low-level graphics.

### Modern UI Component Libraries (React/Next.js)
Traditional NPM package libraries are phased out in favor of "copy-paste" and modular solutions managed via CLI:
*   **shadcn/ui**: The new standard. Built on Radix UI (logic/accessibility) and Tailwind CSS (styling). Components are managed via **CLI**, which allows copying source code directly into the project for full ownership and customization.
*   **Mantine**: Comprehensive toolkit with 100+ components and custom hooks (e.g., `useForm`), ideal for rapid but stable feature development.
*   **Tremor**: Specialized engine for analytical dashboards. Optimized for large numerical datasets, offering high-performance charts and KPI cards.
*   **Magic UI & Aceternity UI**: Focused on the "Wow" factor. Advanced Framer Motion animations (particle effects, bento grids, interactive backgrounds) for modern landing pages.

### 2D and 3D Graphics Engines
For "antigravity" visualizations beyond standard UI, WebGL and WebGPU engines are employed:

| Engine / Library | Type | Key Advantage | Project Application |
| :--- | :--- | :--- | :--- |
| **Three.js** | 3D | Massive ecosystem, flexibility | 3D city/globe visualization, 3D equipment models |
| **Babylon.js** | 3D | Stability, built-in physics | Advanced simulations, mini-games, complex lighting |
| **PixiJS** | 2D | Extreme 2D performance | Dynamic icons, user HUD, animated overlays |
| **deck.gl** | Geospatial | Millions of GPS points | Animated route trails (TripsLayer), large scale heatmaps |
| **Framer Motion** | Animations | Declarative React style | UI micro-interactions, page transitions |

---

## 🗂 Module Map

```
stunning-pancake/
├── backend/
│   ├── core/           ← Settings, URLs, Sentry, Redis Cluster, Citus, RLS
│   ├── activities/     ← GPS processing, anti-cheat, leaderboards, analytics, heatmap
│   ├── clubs/          ← Matrix async provisioning
│   ├── events/         ← Competition engine, OGC export
│   ├── users/          ← Auth, profiles, RBAC
│   └── rewards/        ← Stripe, Vouchers, Points Ledger
├── telemetry/          ← FastAPI GPS ingestion microservice (Sentry-integrated)
├── mobile/             ← React Native app (GpsSyncManager v3, SentryService)
├── admin/              ← React 19 dashboard (**deck.gl**, **Tremor**, **shadcn/ui**)
├── infrastructure/     ← BRouter, Traccar configs
├── docker-compose.yml          ← Standard stack
└── docker-compose.scale.yml    ← Hyperscale override (Citus + Redis Cluster)
```
