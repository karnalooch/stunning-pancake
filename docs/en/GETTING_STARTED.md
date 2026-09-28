# 4VELO local setup

| Pole / Field | Wartość / Value |
|---|---|
| **Status** | Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-09-28 |
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
python scripts/home_lab.py init
```

Install JavaScript dependencies from the workspace root. `home_lab.py init` creates
the ignored private `.env.home` used by the isolated local/pilot stack and refuses
to overwrite an existing file. Do not copy production credentials into it. If this
checkout already has a legacy `.env.home`, do not regenerate it just to add newer
keys; follow the [home-lab runbook](operations/HOME_LAB.md) instead.

The generated home-lab configuration keeps demo seeding disabled and provides the
dedicated local database, GLOBAL_OWNER, Django, telemetry and backup secrets required
by the canonical pilot path.

## Startup and verification

```powershell
python scripts/home_lab.py config
python scripts/home_lab.py up
python scripts/home_lab.py status
python scripts/home_lab.py check
```

This is the canonical local/pilot startup path. Do **not** substitute bare
`docker compose up`: Docker Compose automatically loads `docker-compose.override.yml`
for that form, while the pilot home lab deliberately layers only
`docker-compose.yml` + `docker-compose.home.yml` under project `4velo-home`.

The default home-lab core starts PostGIS/TimescaleDB, Redis, Django, telemetry,
GLOBAL_OWNER admin, the main Celery worker and beat. Routing, simulation, tracking
and the extra admin surfaces are optional profiles; enable them through
`home_lab.py up --routing|--simulation|--tracking|--all-admin`. Image builds and
routing-data preparation can take longer than the core startup.

| Service | Expected local address |
|---|---|
| API documentation | http://localhost:8000/api/docs/ |
| Global Admin | http://localhost:3001 |
| Tenant Admin (with `--all-admin`) | http://localhost:3002 |
| Moderator (with `--all-admin`) | http://localhost:3003 |
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
python scripts/home_lab.py down
```

`home_lab.py down` removes the home-lab containers/network but preserves the named
database volume. Do not use `docker compose down -v` for routine shutdown.

## Deployment and next steps

Deployment is separate from local setup. Read [operations](operations/README.md)
and the [risk map](../reports/RISK_AND_OWNERSHIP_MAP.md) before configuring Railway
or Kubernetes. Do not seed production or migrate external databases during local trials.

[Development](DEVELOPMENT.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Index](README.md)
