# BACKEND ARCHITECTURE: "SPORT" Platform
> Last Updated: 2026-04-24 | **Hyperscale Edition** (Post Milestone 5)

## 1. Telemetry Core: FastAPI + Redis Pipeline
> **Architectural Synergy**: We use a dual-framework approach. **Django (DRF)** handles the complex business logic, auth (Admin/Moderator), and relational data, while **FastAPI** provides a high-performance, async ingestion layer for GPS streams.


### Data Flow (Current)
```
MOBILE (30s batch) → FastAPI :8001 → Redis Pipeline → TimescaleDB Hypertable
                                    ↓
                             Celery: process_activity
                               └─ Layer 1: Fast Selection Gate (O(N) math, no I/O)
                               └─ Layer 1.5: ML Anomaly Detector (IsolationForest)
                               └─ Layer 2: V-max Kinematic Check
                               └─ Layer 3: BRouter Topological Validation (Viterbi HMM)
                               └─ Layer 4: Leaderboard Sync + Points Award
```

- **FastAPI + asyncpg**: Non-blocking I/O, handles 10k+ req/sec on a single node.
- **Redis Pipeline**: Buffers GPS points in memory before writing to TimescaleDB in batches.
- **TimescaleDB Hypertables**: GPS points auto-partitioned by time — reads and writes never contend.

---

## 2. Multi-Layer Anti-Cheat Engine (5 Layers)

| Layer | Technology | Cost | Rejects |
|:---|:---|:---|:---|
| **1. Fast Gate** | Pure Python math (O(N), no I/O) | ~0.5ms | Teleports, cars, trams |
| **1.5 ML Gate** | IsolationForest (8 kinematic features) | ~5ms | Statistical outliers |
| **2. V-max** | Biomechanical ceilings per sport | ~1ms | Unrealistic speeds |
| **3. BRouter** | Viterbi HMM map-matching (OSM) | ~200ms | Off-road GPS fraud |
| **4. Plugin** | `core/plugin_registry.py` hooks | custom | Domain-specific rules |

**Key design**: Each layer only runs if the previous passes. 90%+ of cheats are caught at Layer 1 (zero cost).
- **Z-Score Anomaly**: Layer 1.5 utilizes statistical Z-scores (via NumPy/Pandas) to flag sudden tempo spikes inconsistent with the user's fatigue profile.


---

## 3. High-Performance Leaderboards: Redis Cluster + PostGIS

### Real-time (Redis Cluster — Hyperscale)
- **3 Master nodes** (16,384 hash slots distributed) + 3 replicas for failover.
- **Sorted Sets**: Instant rankings for active events and 200 cities simultaneously.
- **Pipeline Batching**: Bulk `ZADD` via `core/redis_cluster.py` — auto-detects standalone vs cluster.
- **Read replicas**: GET operations routed to replicas → 3× read throughput.

### Official Rankings (PostGIS)
- **Materialized Views**: `city_rankings_mv` — source of truth for official municipal rankings.
- **Async Refresh**: Celery `refresh_city_rankings_mv` task refreshes concurrently (non-blocking).

---

## 4. Distributed Database: Citus Sharding (`core/citus.py`)

For hyperscale deployment, TimescaleDB runs inside a **Citus 4-node cluster**:

| Node | Role | Data |
|:---|:---|:---|
| `db` | Coordinator | Query routing, metadata |
| `db-worker-1` | Worker | Shards 0-10 |
| `db-worker-2` | Worker | Shards 11-21 |
| `db-worker-3` | Worker | Shards 22-31 |

**Sharding strategy**: Distributed by `user_id` → all data for a given user is co-located on a single worker. JOINs are **local** (no network hops).

**Reference tables** (replicated to all workers): `users_user`, `events_event`, `clubs_club`, `rewards_voucherpool`.

---

## 5. Async Task Architecture: Celery (3 Queues)

| Queue | Workers | Purpose |
|:---|:---|:---|
| `critical` | 8 concurrent | Anti-cheat validation, BRouter, Leaderboard sync |
| `default` | 8 concurrent | ML scoring, reward awarding, MV refresh |
| `notifications` | 4 concurrent | Matrix chat, push, email |

All queues are backed by **Redis** (standalone or cluster — transparent).

---

## 6. Rewards & Payments (`rewards/`)

- **StripeService**: B2C checkout, B2B multi-seat, Customer Portal, Webhook with signature validation.
- **RewardsService**: Points ledger (append-only), atomic voucher redemption via `SELECT FOR UPDATE`.
- **Points Pipeline**: Auto-awarded after activity verification (10 pts/km, idempotent).

---

## 7. Security Architecture

- **RLS**: PostgreSQL Row Level Security on 5 tables (`core/rls.py`). Tenant isolation at DB level.
- **Trivy CI**: Automated CVE scans for backend/admin/mobile on every push → SARIF to GitHub Security.
- **Dependabot**: 4 ecosystems (backend, telemetry, admin, mobile), `security-patches` auto-group.
- **Sentry**: Django + Celery + FastAPI + Mobile with GPS-stripping `beforeSend` hook (zero PII).

---

## 8. Domain-Driven Design (DDD)

```
backend/
├── core/
│   ├── redis_cluster.py      ← Redis Cluster manager (auto-detect)
│   ├── citus.py              ← Citus sharding manager
│   ├── rls.py                ← PostgreSQL Row Level Security
│   ├── plugin_registry.py   ← Plugin hook system
│   ├── sentry.py             ← Observability configuration
│   └── infra_views.py        ← /api/infra/health/ monitoring
├── activities/
│   ├── signal_processing.py  ← GPS processing engine
│   ├── ml_anomaly.py         ← IsolationForest anti-cheat (Layer 1.5)
│   ├── analytics.py          ← Riegel predictions, ACWR, trend analysis
│   ├── heatmap.py            ← Heatmap API + premium analytics endpoint
│   ├── leaderboards.py       ← Redis Cluster leaderboard service
│   └── tasks.py              ← Celery async pipeline
├── clubs/
│   ├── tasks.py              ← Matrix async provisioning
│   └── signals.py            ← Club/membership lifecycle hooks
└── rewards/
    ├── models.py             ← Sponsor, VoucherPool, Voucher, PointsLedger
    ├── services.py           ← Atomic redemption + balance
    └── stripe_service.py     ← Stripe B2C/B2B/Portal/Webhook
```

---

## 9. Observability & Monitoring (Prometheus & Grafana)

A proactive observability stack is essential for visualizing the internal state of the business engine.
- **Metrics Engine**: **Prometheus** scraping the FastAPI `/metrics` endpoint. Collecting Counters (RPS), Gauges (active connections), Histograms (latency percentiles like P95/P99), and Summaries.
- **Visualization**: **Grafana** dashboards visualizing infrastructure and business logic.
  - **Heatmaps**: Identifying "tail latency" and performance segment distribution.
  - **Per-Task Monitoring**: Tracking resource usage per specific business pipeline stage.
  - **Geomaps**: Utilizing Grafana Geomaps and Performance Co-Pilot (PCP) to map performance metrics to physical geographic coordinates.

## 10. Future Strategic Optimizations

The following optimizations are planned for implementation to enhance data integrity and processing efficiency:
- **Signal Cleaning (DBSCAN)**: Implementing Density-Based Spatial Clustering of Applications with Noise to identify and remove noise points from raw GPS data at the ingestion layer.
- **Trajectory Similarity Analysis**: Utilizing **Fréchet distance** and **Hausdorff distance** to detect route duplication or sophisticated spoofing patterns.
- **GIST Indexing**: All spatial columns must be indexed using GIST to ensure sub-millisecond query times.
- **ST_Subdivide**: Large city polygons or long tracks are divided into smaller fragments (MBRs) to maximize index efficiency and reduce query time from minutes to seconds.
- **Geometry Simplification**: Use algorithms like **Douglas-Peucker** to store simplified versions of tracks.
- **Spoofing Detection (IMU Correlation)**: Analyzing acceleration discrepancies between GPS data and physical IMU (accelerometer) data to detect "drag-off" attacks.
