# T73 review checklist

- [ ] Django runtime role guard rejects PostgreSQL `SUPERUSER`.
- [ ] Django runtime role guard rejects PostgreSQL `BYPASSRLS`.
- [ ] Production cannot opt out of the guard.
- [ ] Pilot/home lab enables the same guard with `RLS_RUNTIME_ROLE_GUARD=1`.
- [ ] Migrations can use a separate privileged connection while web runtime restores the non-bypass `DATABASE_URL`.
- [ ] All Celery tasks clear RLS GUCs before execution and after return.
- [ ] Tenant/global-owner task scopes are validated and mutually exclusive.
- [ ] Parent-task propagation copies only the two whitelisted scope headers.
- [ ] Top-level web dispatch derives scope only from server-controlled PostgreSQL GUCs.
- [ ] Cross-tenant Beat maintenance jobs have explicit internal global-owner scope.
- [ ] Activity validation is queued with the persisted activity tenant.
- [ ] Deferred event session creation rebinds from the persisted user tenant.
- [ ] Home-lab Compose explicitly layers the canonical base and pilot override.
- [ ] Home-lab runtime role bootstrap is idempotent and forces `NOSUPERUSER NOBYPASSRLS`.
- [ ] Home-lab CI validates the actual layered Compose model.
- [ ] Focused T73 tests, backend CI and Aggregate CI gate are green.
- [ ] Runtime/home-lab evidence is not claimed until the environment has actually been started and verified.
