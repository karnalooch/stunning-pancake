# 4VELO home test environment
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-29 |
| **Audience** | Developers and operators |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-28 |
| **canonical_path** | docs/en/operations/HOME_LAB.md |

---

The home lab mirrors the service boundaries used by the pilot while using only the local `4velo-home` Compose project, private `.env.home`, and Docker volumes. Do not copy production secrets or production data into it.

Use `python scripts/home_lab.py ...` as the only canonical control path. Bare `docker compose ...` is not equivalent because Compose auto-loads `docker-compose.override.yml`; the pilot path deliberately and explicitly layers only `docker-compose.yml` followed by `docker-compose.home.yml`.

## Requirements

- Git;
- Node.js 24.21.0 and pnpm 12.4.2 through Corepack;
- Python 3.12;
- Docker Desktop or Docker Engine with Docker Compose v2.

The read-only `python scripts/dev_doctor.py` owns the canonical host prerequisite checks; this runbook does not invent separate RAM/disk thresholds.

## First start

```powershell
python scripts/home_lab.py init
python scripts/home_lab.py cold-start-smoke
```

`init` creates ignored `.env.home` and refuses to overwrite an existing file. It generates independent local values for the database password, dedicated GLOBAL_OWNER `ADMIN_PASSWORD`, Django `SECRET_KEY`, telemetry JWT signing secret, and AES-256 backup key. Secret values are never written to T87 evidence.

`up` validates the layered Compose model, executes the profiled one-shot `backend_migrate` bootstrap with the privileged database owner, then starts runtime services with `up -d --build --wait` and probes the backend, telemetry, and GLOBAL_OWNER admin HTTP surfaces. The backend/worker runtime containers never receive the migration-owner credential.

For a home lab created before T87, do **not** delete/regenerate `.env.home` just to add this field because that would also rotate database/signing keys. Add a strong local `ADMIN_PASSWORD` entry to the existing private file before the next `up`. If the GLOBAL_OWNER account already exists, this does not rotate that account's existing password; role-login acceptance remains the separate T86 runtime smoke.

The default core contains PostGIS/TimescaleDB, Redis, Django, telemetry, global admin, the main Celery worker, and beat. Enable optional services explicitly:

```powershell
python scripts/home_lab.py up --routing
python scripts/home_lab.py up --simulation
python scripts/home_lab.py up --tracking
python scripts/home_lab.py up --all-admin
```

Profiles can be combined. `simulation` also enables BRouter and OSRM. Initial routing-data preparation may download large files and take much longer than the core startup.

## T90 cold-start smoke and `DEV ENV READY`

After a green doctor and one-time `init`, run the canonical environment-readiness proof with one command:

```powershell
python scripts/home_lab.py cold-start-smoke
```

The same migration primitive is also available explicitly for operator/debug use:

```powershell
python scripts/home_lab.py migrate
```

The command is fail-closed. From a known process state it runs `down --remove-orphans` **without `-v`**, preserving named volumes and local data. It then validates exactly `docker-compose.yml` + `docker-compose.home.yml`, runs the one-shot `backend_migrate` bootstrap first, and only after that succeeds runs `up -d --build --wait`. It verifies the core services and backend/telemetry/GLOBAL_OWNER HTTP surfaces, proves that Django has no pending migrations, and actively probes PostgreSQL, Redis, and the main Celery worker path.

Only after the complete contract passes does it write secret-free exact-SHA evidence to `backups/home-lab/evidence/t90-dev-env-ready-*.json` and print `DEV ENV READY`. A bare `docker compose up`, container status, or a single health endpoint is not equivalent evidence.

Retries are deterministic: the smoke removes stale containers/orphans first but never deletes named volumes. A failed partial stack may remain available for diagnosis; the next smoke starts again with the controlled restart.

## Daily operation

```powershell
python scripts/home_lab.py status
python scripts/home_lab.py check
python scripts/home_lab.py down
```

`check` requires all core services to be running and verifies backend, telemetry, and GLOBAL_OWNER admin HTTP. `down` preserves the database volume. Avoid `docker compose down -v` unless deleting local data is intentional.

## T87 pilot operator gate

Run the canonical gate from the exact clean Git checkout intended for the pilot after the core services are up:

```powershell
git status --short
python scripts/home_lab.py operator-gate
```

The command fails closed unless the pilot configuration is initialized and preserves the required runtime invariants. It then:

1. binds the run to the exact clean Git commit;
2. validates the layered Compose configuration;
3. checks backend, telemetry, and GLOBAL_OWNER admin HTTP;
4. proves that Django has no pending migrations with `migrate --check`;
5. creates an authenticated AES-256-GCM encrypted backup without plaintext staging;
6. restores that backup only into the isolated `4velo_restore_check` database and removes the verification database afterwards;
7. writes a secret-free JSON PASS artifact under `backups/home-lab/evidence/t87-operator-*.json`.

The evidence contains the commit SHA, timestamps, sanitized invariant results, endpoint names/URLs, migration result, encrypted backup filename/hash, and isolated-restore result. It does not contain passwords, signing keys, Django secrets, or the backup encryption key.

T87 is **DONE**: the operator gate was executed on the intended pilot home lab against clean commit `5085b5215e6ff82a7397685252a42525f86113b8`. Core HTTP health and migration checks passed, encrypted backup `4velo-home-20260927-235157.dump.enc` was created, isolated restore passed, and commit-bound evidence was written to `backups/home-lab/evidence/t87-operator-20260927-235202.json`.

## Backup and restore verification

Individual backup/restore primitives remain available:

```powershell
python scripts/home_lab.py backup
python scripts/home_lab.py verify-restore backups/home-lab/4velo-home-YYYYMMDD-HHMMSS.dump.enc
```

The artifact is an authenticated AES-256-GCM encrypted wrapper around custom `pg_dump` output without owners or ACLs. Plaintext is streamed directly into encryption and is not staged on disk. `verify-restore` authenticates/decrypts the artifact into a separate `4velo_restore_check` database, checks the migrations table, and removes the verification database. It never modifies the active home-lab database.

The script intentionally has no command that restores over the active database.

## Critical-path test

After a successful T87 operator gate, role-specific T84/T85/T86 runtime acceptance remains separate: physical Android acceptance, TENANT_ADMIN smoke, and GLOBAL_OWNER role smoke each keep their own evidence boundary.

The home lab does not prove production domains, TLS, provider-managed backups, production capacity, or Railway variables. It proves the repo-controlled pilot configuration, migrations, core service communication, encrypted backup, and isolated restore path before pilot sign-off.
