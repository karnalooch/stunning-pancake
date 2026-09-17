# T73 implementation summary

The tranche introduces a dedicated non-bypass PostgreSQL runtime-role contract and an explicit Celery RLS task boundary. Production is always guarded; the pilot home lab opts into the same role check. Migrations can use a separate privileged connection, but web and worker runtime traffic returns to the constrained `DATABASE_URL`.

Celery tasks clear RLS context before and after execution, validate mutually exclusive tenant/global-owner scope, propagate only whitelisted server-controlled scope, and close the DB connection when cleanup cannot be trusted. Cross-tenant Beat maintenance gets an explicit internal global-owner GUC. Activity validation carries the persisted activity tenant, while queued event-session creation rebinds from the persisted user tenant.

The home-lab overlay now bootstraps a `NOSUPERUSER NOBYPASSRLS` runtime login and the control script explicitly layers the canonical Compose file before the home override. CI validates that exact layered configuration.
