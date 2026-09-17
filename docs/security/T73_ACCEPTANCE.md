# T73 acceptance

Repo-side T73 is acceptable when code review and CI prove the following properties:

1. guarded web/Celery runtimes reject PostgreSQL roles with `SUPERUSER` or `BYPASSRLS`;
2. a separate migration connection does not become the serving runtime connection;
3. Celery workers clear tenant/global-owner GUCs at every task boundary and propagate only trusted validated scope;
4. pilot-critical tenant work explicitly binds or rebinds scope from persisted/authenticated server-side data;
5. trusted cross-tenant periodic work uses explicit global-owner GUC scope rather than PostgreSQL bypass privileges;
6. the home-lab Compose model actually starts application services with the dedicated non-bypass runtime login.

A green repository CI run is necessary but does not by itself prove the role flags of an external Railway/production database. That environment proof remains operational evidence and must not be fabricated.
