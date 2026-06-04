# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../operations/BROUTER.md) |
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

## URL in Railway

| Customer | URL |
|--------|-----|
| `celery-worker-simulation`, routing, backend | `BROUTER_URLS` (prod): `http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter` - round-robin in `BRouterService` |
| Single (Compose / dev) | `BROUTER_URL=http://brouter:17777/brouter` |
| Browser/curl from laptop | only if publicly displayed (usually **not**) |

---

## Implementation (shortcut)

1. **brouter** service with Dockerfile `infrastructure/brouter/Dockerfile`, build context = **root repo** (`numReplicas: 1` - volume).
2. Optional **brouter-2** - the same Dockerfile, config `infrastructure/brouter-2/railway.json`, separate volume **`/brouter/segments4`** (first start ~10-30 min of PL download).
3. Volume on each BRouter site (≥ 2 GB) - `.rd5` tiles will survive redeploy.
4. Workers: `BROUTER_URLS` (two hosts); `BROUTER_URL` optional fallback until the code from `main` is deployed.
5. Preset **`poland`** - 16 tiles, ~1 GB; first start 10-30 min on new volume.
6. `BROUTER_SYNC_LOOKUPS=1` - `lookups.dat` v11 compatible with segments from brouter.de.

Build/volume details: [infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md).

---

## Error: `HTTP 400: no track found at pass=0`

**Meaning:** BRouter did not attach the **starting point** to the road network (water, field, no profile).

**In the simulator (from 2026-06-02):**

- Start from **city center**, then random attempts within a radius of `SCALE_SIM_BROUTER_START_RADIUS_KM` (default 4 km).
- Fallback of `trekking` profile after `bicycle`.
- Route leg limit: `SCALE_SIM_BROUTER_MAX_LEG_KM=4`.

**Check:**

1. A tile for the region exists and &gt; 1 MB (e.g. `E20_N50.rd5` for central Poland).
2. Container logs: missing `lookup version mismatch lookups.dat=10 … rd5=11`.
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

User route validation: `BRouterService` in `backend/activities/services.py` - profiles `bicycle`, `foot-all`, etc. This is the same server as the simulator, but a separate code path from the live sim.
