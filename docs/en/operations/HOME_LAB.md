# 4VELO home test environment
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-10 |
| **Audience** | Developers and operators |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-10 |
| **canonical_path** | docs/en/operations/HOME_LAB.md |

---

The home lab mirrors service boundaries intended for later Railway deployment while using only the local `4velo-home` Compose project, `.env.home`, and Docker volumes. Do not copy production secrets or data into it.

## Requirements

- Docker Desktop with WSL2, or Docker Engine with `docker compose` support;
- at least 16 GB RAM and 40 GB free disk space;
- Git and Python 3.12+ for the control script.

## First start

```powershell
python scripts/home_lab.py init
python scripts/home_lab.py config
python scripts/home_lab.py up
```

`init` creates ignored `.env.home` with three independent random secrets and refuses to overwrite it. `up` validates Compose, builds images, waits for health checks, then probes backend and telemetry HTTP endpoints.

The default core contains PostGIS/TimescaleDB, Redis, Django, telemetry, global admin, the main Celery worker, and beat. Enable optional services explicitly:

```powershell
python scripts/home_lab.py up --routing
python scripts/home_lab.py up --simulation
python scripts/home_lab.py up --tracking
python scripts/home_lab.py up --all-admin
```

Profiles can be combined. `simulation` also enables BRouter and OSRM. Initial routing-data preparation may download large files and take much longer than the core startup.

## Daily operation

```powershell
python scripts/home_lab.py status
python scripts/home_lab.py check
python scripts/home_lab.py down
```

`down` preserves the database volume. Avoid `docker compose down -v` unless deleting local data is intentional.

## Backup and restore verification

```powershell
python scripts/home_lab.py backup
python scripts/home_lab.py verify-restore backups/home-lab/4velo-home-YYYYMMDD-HHMMSS.dump
```

The backup uses custom `pg_dump` format without owners or ACLs. `verify-restore` creates a separate `4velo_restore_check` database in the local container, restores the file, checks the migrations table, and removes the verification database. It does not modify the main lab database.

The script intentionally has no command that restores over the main database. A successful isolated check is required before preparing a separate, explicit disaster-recovery procedure.

## Critical-path test

After a successful `check`, test login, test-user creation, activity storage, GPS ingest with a valid JWT, Celery task processing, and visibility in admin. Record the commit and backup filename with the result.

The home lab does not verify domains, TLS, provider backups, capacity, or Railway variables. It does verify images, migrations, service communication, and data restoration before deployment.
