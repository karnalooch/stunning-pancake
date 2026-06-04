# BRouter — operations runbook

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/BROUTER.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/BROUTER.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

**Image:** `infrastructure/brouter/Dockerfile` (BRouter 1.7.9, `RouteServer` HTTP :17777) · **Caps:** [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)

---

## URL on Railway

| Consumer | URL |
|--------|-----|
| `celery-worker-simulation`, routing worker, backend | `BROUTER_URLS` (prod): `http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter` — round-robin in `BRouterService` |
| Single instance (Compose / dev) | `BROUTER_URL=http://brouter:17777/brouter` |
| Browser/curl from laptop | only if exposed publicly (usually **not**) |

---

## Deployment (shortcut)

1. **brouter** service with Dockerfile `infrastructure/brouter/Dockerfile`, build context = **repo root** (`numReplicas: 1` — volume).
2. Optional **brouter-2** — same Dockerfile, config `infrastructure/brouter-2/railway.json`, separate volume **`/brouter/segments4`** (first start ~10–30 min PL download).
3. Volume on each BRouter service (≥ 2 GB) — `.rd5` tiles survive redeploy.
4. Workers: `BROUTER_URLS` (two hosts); `BROUTER_URL` optional fallback until code from `main` is deployed.
5. Preset **`poland`** — 16 tiles, ~1 GB; first start 10–30 min on a new volume.
6. `BROUTER_SYNC_LOOKUPS=1` — `lookups.dat` v11 compatible with segments from brouter.de.

Build/volume details: [infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md).

---

## Error: `HTTP 400: no track found at pass=0`

**Meaning:** BRouter could not snap the **start point** to the road network (water, field, wrong profile).

**In the simulator (since 2026-06-02):**

- Start from **city center**, then random attempts within `SCALE_SIM_BROUTER_START_RADIUS_KM` (default 4 km).
- Fallback `trekking` profile after `bicycle`.
- Route leg limit: `SCALE_SIM_BROUTER_MAX_LEG_KM=4`.

**Check:**

1. A tile for the region exists and is &gt; 1 MB (e.g. `E20_N50.rd5` for central Poland).
2. Container logs: no `lookup version mismatch lookups.dat=10 … rd5=11`.
3. `BROUTER_URL` on the simulation worker points to the **internal** Railway host.

---

## BRouter container variables

| Variable | Default |
|---------|-----------|
| `BROUTER_SEGMENT_PRESET` | `poland` |
| `BROUTER_AUTO_DOWNLOAD_SEGMENTS` | `1` |
| `BROUTER_JAVA_XMX` | `768m` |
| `BROUTER_SYNC_LOOKUPS` | `1` |

---

## Anti-cheat (production)

User route validation: `BRouterService` in `backend/activities/services.py` — profiles `bicycle`, `foot-all`, etc. Same server as the simulator, separate code path from live sim.
