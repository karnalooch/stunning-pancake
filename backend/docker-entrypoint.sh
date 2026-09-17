#!/bin/sh
set -eu

# Explicit commands (workers, beat, maintenance) must not start the web server.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# T73: migrations may use a privileged owner connection, while the serving
# process must use DATABASE_URL backed by a NOSUPERUSER/NOBYPASSRLS role.
_runtime_database_url="${DATABASE_URL:-}"
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    export DATABASE_URL="$MIGRATION_DATABASE_URL"
    python manage.py migrate --no-input
    export DATABASE_URL="$_runtime_database_url"
else
    python manage.py migrate --no-input
fi

# In production and the opted-in pilot home lab this includes core.E002,
# which fails closed if DATABASE_URL can bypass PostgreSQL RLS.
python manage.py check --deploy
python manage.py create_admin

if [ "${RUN_DEMO_SEED:-0}" = "1" ]; then
    echo "RUN_DEMO_SEED=1: loading demonstration data"
    python seed_data.py
fi

python manage.py collectstatic --no-input

exec gunicorn \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    core.wsgi:application
