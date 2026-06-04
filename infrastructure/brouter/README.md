# BRouter (local Docker / Railway)

- **URL (Compose / workers):** `http://brouter:17777/brouter`
- **Host (from machine):** `http://localhost:17777/brouter`

## Map segments (automatic)

The container **downloads missing `.rd5` tiles on startup** from [brouter.de/segments4](https://brouter.de/brouter/segments4/).

| Variable | Default | Meaning |
|----------|---------|---------|
| `BROUTER_AUTO_DOWNLOAD_SEGMENTS` | `1` | `0` = skip download |
| `BROUTER_SEGMENT_PRESET` | `poland` | `poland` (full PL), `minimal` (3 tiles), `custom`, `none` |
| `BROUTER_SEGMENT_TILES` | — | With `custom`: comma list, e.g. `E20_N50.rd5,E15_N50.rd5` |
| `BROUTER_SEGMENTS_DIR` | `/brouter/segments4` | Segment directory |
| `BROUTER_SEGMENTS_URL` | `https://brouter.de/brouter/segments4` | Base URL |
| `BROUTER_JAVA_XMX` | `768m` (local); **3g** on Railway prod | Heap — leave ~1 GB for OS/off-heap below container RAM |
| `BROUTER_MAX_THREADS` | `4` (entrypoint); **12** on Railway prod | HTTP worker threads in `RouteServer` — **main throughput knob** |
| `BROUTER_PROFILES_URL` | `https://brouter.de/brouter/profiles2` | `lookups.dat` + profiles (must match segment version) |
| `BROUTER_SYNC_LOOKUPS` | `1` | Refresh `lookups.dat` on each container start |

**Lookup mismatch:** If logs show `lookup version mismatch (old rd5?) lookups.dat=10 … rd5=11`, redeploy `brouter` (image pulls current `lookups.dat` from brouter.de). Segments from brouter.de/segments4 and profiles must use the same lookup generation.

**Preset `poland`:** 16 tiles (E10–E25, N40–N55), ~**1.0–1.2 GB** total. First deploy can take **10–30+ minutes** while tiles download.

**Railway:** mount a volume at `/brouter/segments4` so tiles are **not re-downloaded** on every redeploy. Size the volume to **≥ 2 GB** (Hobby live-resize if needed).

**Railway caveat:** a service with a volume **cannot** use `numReplicas > 1`. For ~2× throughput add a second service **`brouter-2`** (own volume, same Dockerfile) and set `BROUTER_URLS` on workers — see `infrastructure/brouter-2/railway.json` and `scripts/railway-setup-brouter-2.ps1`.

Manual upload is optional (`railway volume files upload`).

## Throughput (live sim)

One `RouteServer` instance handles at most **`BROUTER_MAX_THREADS`** concurrent route requests. Extra Celery routing workers queue at BRouter unless you raise threads and/or add another service.

| Setup | Approx. concurrent BRouter routes |
|-------|-----------------------------------|
| Default (4 threads, 1 instance) | **4** |
| Railway prod (`brouter`: 12 threads, 1 instance + volume) | **~12** |
| Railway prod (`brouter` + `brouter-2`, 12 threads each) | **~24** |

RAM alone does not help if `BROUTER_MAX_THREADS` stays at 4. Pair **4 GB container** with **Xmx≈3g** and **threads≈2× CPU**.

## Railway build

- **Dockerfile path:** `infrastructure/brouter/Dockerfile` (repo root as build context).
- **Root directory:** leave empty `/` (not `infrastructure/brouter`), so `COPY infrastructure/brouter/entrypoint.sh` resolves.
- Optional config-as-code: `/infrastructure/brouter/railway.json` (absolute path from repo root).

## Build

```bash
docker compose build brouter
docker compose up -d brouter celery_worker_simulation
```

Releases: `abrensch/brouter` on GitHub (`brouter-X.Y.Z.zip`), not legacy `brouter/brouter` URLs.
