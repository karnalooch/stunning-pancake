# 4VELO home test environment
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-28 |
| **Audience** | Developers and operators |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-28 |
| **canonical_path** | docs/en/operations/HOME_LAB.md |

---

The home lab mirrors the service boundaries used by the pilot while using only the local `4velo-home` Compose project, private `.env.home`, and Docker volumes. Do not copy production secrets or production data into it.

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

`init` creates ignored `.env.home` and refuses to overwrite an existing file. It generates independent local values for the database password, dedicated GLOBAL_OWNER `ADMIN_PASSWORD`, Django `SECRET_KEY`, telemetry JWT signing secret, and AES-256 backup key. Secret values are never written to T87 evidence.

`up` validates the layered Compose model, builds images, waits for service health, then probes the backend, telemetry, and GLOBAL_OWNER admin HTTP surfaces.

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

A repo-side green T87 implementation is still **PARTIAL** until this command is executed on the exact intended pilot environment and that evidence is reviewed.

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
