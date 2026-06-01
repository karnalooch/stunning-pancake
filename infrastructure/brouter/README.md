# BRouter (local Docker)

- **URL (Compose / workers):** `http://brouter:17777/brouter`
- **Host (from machine):** `http://localhost:17777/brouter`

## OSM segments

Routing needs map data under `segments4/` (gitignored). Without tiles, HTTP may succeed but route requests return no path → simulator grid fallback.

Download a regional extract and import per [BRouter docs](https://github.com/brouter/brouter), or mount a prebuilt `segments4` directory into `/brouter/segments4`.

## Build

```bash
docker compose build brouter
docker compose up -d brouter celery_worker_simulation
```
