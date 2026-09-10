# 4VELO local setup

| Pole / Field | Wartość / Value |
|---|---|
| **Status** | Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-09-10 |
| **lang** | en |
| **translation** | [Polski](../pl/GETTING_STARTED.md) |
| **canonical_path** | docs/en/GETTING_STARTED.md |

## Scope

This guide is based on repository configuration. Full Compose startup still requires
local verification; the addresses below are not evidence of healthy services.
See the [takeover guide](../PROJECT_TAKEOVER.md) for project limitations.

## Tools

- Git, Node 20 (CI version), pnpm 9.15.
- Docker with Compose 2 and resources for PostGIS, Redis and routing services.
- Python 3.12 for CI-aligned local tools; service images use Python 3.11.

## Preparation

```powershell
git clone https://github.com/karnalooch/stunning-pancake.git 4velo
cd 4velo
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Copy `.env` only on first setup. In Bash, use `cp .env.example .env`.
Install JavaScript dependencies from the workspace root. Replace existing values
in `.env` rather than appending a duplicate `SECRET_KEY`. Set a private random key,
the database variables required by Compose, and `DEBUG=1` for local use only.
Do not use production credentials.

Keep `RUN_DEMO_SEED=0`. The backend creates an initial administrator without demo
seeding. The default username is `global_owner`; if no password reaches the container,
the first startup log contains a generated password. Adding a variable to `.env`
does not automatically pass it into a container: inspect the service's `environment`.
Do not publish the first-start log.

## Startup and verification

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Compose also includes BRouter, OSRM, Traccar and simulators; image builds and map
downloads can take time. By default the backend migrates, creates the administrator,
collects static files and starts Gunicorn. It does not generate migrations at startup.
Workers and beat run their own commands without web initialization. Wait for the
database and backend migrations before running integration tests.

| Service | Expected local address |
|---|---|
| API documentation | http://localhost:8000/api/docs/ |
| Global Admin | http://localhost:3001 |
| Tenant Admin | http://localhost:3002 |
| Moderator | http://localhost:3003 |
| Telemetry | http://localhost:8001 |

These addresses come from Compose, not a live availability test. Inspect local
service logs if a container restarts. Do not publish credentials or user data.

## Tests and shutdown

The [command matrix](../reports/QUALITY_COMMAND_MATRIX.md) records requirements
and audit results. PostGIS tests require PostGIS, not substitute SQLite storage.

```bash
python scripts/check_docs_links.py
corepack pnpm --filter admin typecheck
corepack pnpm --filter admin test:run
docker compose stop
```

`stop` preserves containers and data. Do not use `down -v` for routine shutdown.

## Deployment and next steps

Deployment is separate from local setup. Read [operations](operations/README.md)
and the [risk map](../reports/RISK_AND_OWNERSHIP_MAP.md) before configuring Railway
or Kubernetes. Do not seed production or migrate external databases during local trials.

[Development](DEVELOPMENT.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Index](README.md)
