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
| `BROUTER_JAVA_XMX` | `768m` | Heap (raise if OOM on large presets) |

**Preset `poland`:** 16 tiles (E10–E25, N40–N55), ~**1.0–1.2 GB** total. First deploy can take **10–30+ minutes** while tiles download.

**Railway:** mount a volume at `/brouter/segments4` so tiles are **not re-downloaded** on every redeploy. Size the volume to **≥ 2 GB** (Hobby live-resize if needed).

Manual upload is optional (`railway volume files upload`).

## Build

```bash
docker compose build brouter
docker compose up -d brouter celery_worker_simulation
```

Releases: `abrensch/brouter` on GitHub (`brouter-X.Y.Z.zip`), not legacy `brouter/brouter` URLs.
