# BRouter (local Docker)

- **URL (Compose / workers):** `http://brouter:17777/brouter`
- **Host (from machine):** `http://localhost:17777/brouter`

## OSM segments

Routing needs map data under `segments4/` (gitignored). Without tiles, HTTP may succeed but route requests return no path → simulator grid fallback.

Download regional `.rd5` tiles from [brouter.de segments4](https://brouter.de/brouter/segments4/) (e.g. Poland / Europe), or import per [abrensch/brouter](https://github.com/abrensch/brouter) docs. Mount them into `/brouter/segments4` on Railway.

Releases are published as `brouter-X.Y.Z.zip` on GitHub (`abrensch/brouter`), not the legacy `brouter/brouter` JAR URLs.

## Build

```bash
docker compose build brouter
docker compose up -d brouter celery_worker_simulation
```
