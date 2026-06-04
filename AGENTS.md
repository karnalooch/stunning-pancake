# AGENTS.md

Guidance for AI agents working in the 4VELO monorepo.

## Cursor Cloud specific instructions

### Docker in Cloud Agent VMs

This environment may not run `systemd`, so Docker does not start automatically after install. Before `docker compose`, ensure `dockerd` is running:

```bash
if ! pgrep -x dockerd >/dev/null; then
  sudo dockerd >/tmp/dockerd.log 2>&1 &
  for i in $(seq 1 30); do sudo docker info >/dev/null 2>&1 && break; sleep 1; done
fi
```

Storage driver should be `fuse-overlayfs` (see Docker install notes in cloud setup docs).

### Recommended local dev stack (fast iteration)

Full `docker compose up` builds OSRM (large PBF download) and all services; first boot can take a long time. For day-to-day admin + API work, a practical split is:

| Component | How to run |
|-----------|------------|
| PostgreSQL + Redis | `docker compose up -d db redis` (from repo root; requires `.env` with `POSTGRES_DB`, `POSTGRES_USER`, `DB_PASSWORD`, `SECRET_KEY`) |
| Django API | `cd backend && python3 manage.py runserver 0.0.0.0:8000` with `DATABASE_URL=postgres://4velo_user:<password>@localhost:5432/4velo_db` and `REDIS_URL=redis://localhost:6379/0` |
| Global Admin UI | `cd admin && VITE_APP_MODE=GLOBAL_ADMIN VITE_API_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 3001` |

After DB is up: `python3 manage.py migrate`, `python3 manage.py seed_data`, then ensure `global_owner` password via `core` management `create_admin` (sets `admin123` by default) or `users` `create_admin` (generates a random password if the user already exists).

Default login (after `core.management.commands.create_admin`): **global_owner** / **admin123**. See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

### npm in `admin/`

`npm ci` may fail if `package-lock.json` is out of sync with `package.json` (esbuild peer entries). Use `npm install` in `admin/` when `ci` errors with lockfile sync messages.

### Lint / test (matches CI intent)

See [.github/workflows/ci.yml](.github/workflows/ci.yml). Typical commands:

- **Backend:** `cd backend && pip install -r requirements.txt` plus `ruff`, then `ruff check .`, `python manage.py check`, `python run_pytest.py … -m simulator_light` with `REDIS_URL=redis://localhost:6379/15`
- **Admin:** `cd admin && npm install && npm run lint && npm run test`
- **Telemetry:** `pip install -r telemetry/requirements.txt -r telemetry/requirements-dev.txt`, then `cd telemetry && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -p pytest_asyncio.plugin`
- **GDAL:** Ubuntu backend tests need `gdal-bin libgdal-dev libgeos-dev` when not using Docker for Postgres/PostGIS.

Celery workers are optional for admin dashboard smoke tests; `/api/infra/health/` may report Celery as degraded without workers.

### Full stack via Compose

`cp .env.example .env`, set compose-required vars, then `docker compose up -d`. Ports: API `8000`, telemetry `8001`, global admin `3001`, tenant `3002`, moderator `3003`. See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

### Long-running processes

Use **tmux** (`tmux -f /exec-daemon/tmux.portal.conf`) for `runserver`, Vite, and `docker compose` so sessions survive backgrounding.
