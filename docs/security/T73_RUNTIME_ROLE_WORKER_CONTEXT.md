# T73 — Database runtime role and worker tenant-context contract

T73 closes the repo-side part of the P3 runtime-role/worker-scope gap.

## Runtime database role

Web, telemetry and Celery runtimes must use a PostgreSQL login with `NOSUPERUSER` and `NOBYPASSRLS`. A privileged schema/migration owner may exist separately, but it must not be the serving `DATABASE_URL` role.

`core.db_role_guard` reads the effective `current_user` flags from `pg_roles` and fails closed when the guarded runtime is a superuser, has `BYPASSRLS`, or is not PostgreSQL. Production is always guarded. The pilot/home lab opts in explicitly with `RLS_RUNTIME_ROLE_GUARD=1` even though it runs with `DEBUG=1`.

T17 removes schema mutation and privileged migration credentials from normal web startup. The backend entrypoint uses only the serving `DATABASE_URL` and runs `python manage.py migrate --check --no-input`; pending migrations therefore fail startup without changing schema. Home Lab invokes the profiled one-shot `backend_migrate` service before runtime startup, while Kubernetes uses the separate `sport-backend-migrate` Job.

T18 applies the same ownership boundary to telemetry. FastAPI lifespan performs only read-only schema readiness checks; all telemetry `CREATE`/`ALTER`/index/hypertable work lives in `telemetry/schema_bootstrap.py`. Home Lab runs the profiled one-shot `telemetry_migrate` service, and Kubernetes uses `sport-telemetry-migrate` when the optional telemetry workload is deployed. Privileged migration credentials are scoped to these one-shot paths and are not mounted into API, worker, or telemetry runtimes.

## Celery scope boundary

Every Celery task uses `core.task_rls.RLSScopedTask` as its task base. Before a task starts, the previous connection scope is cleared and at most one trusted scope is applied:

- `4velo_tenant_id` — validated canonical tenant UUID;
- `4velo_global_owner=true` — explicit trusted cross-tenant maintenance scope.

The two scopes are mutually exclusive. Invalid/ambiguous values fail closed. After every task, both RLS GUCs are cleared; if cleanup itself fails the Django DB connection is discarded rather than returned to the pool with uncertain scope.

Task dispatch copies only these whitelisted RLS headers from a parent task. Top-level Django dispatch can derive only the server-controlled `app.tenant_id` / `app.is_global_owner` PostgreSQL GUCs established by authenticated request middleware/JWT authentication or an explicit management-command context.

The activity-completion signal sends the persisted activity tenant explicitly. Deferred event-session creation rebinds scope from the persisted user before touching the RLS-protected `Activity` table, so it cannot trust a possibly unrelated inherited tenant.

Trusted cross-tenant Celery Beat maintenance jobs receive an explicit internal global-owner header instead of depending on a PostgreSQL role that bypasses RLS.

## Home-lab proof path

`scripts/home_lab.py` now explicitly layers `docker-compose.yml` and `docker-compose.home.yml`; the override was never intended to run alone. CI validates that exact layered model and optional profiles. The home-lab startup path blocks backend serving when its runtime login can bypass RLS.

Physical/runtime evidence still has to be produced by actually starting the pilot/home lab. Repo-side CI proves configuration/tests, not the state of an external production database role.
