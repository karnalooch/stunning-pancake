#!/bin/sh
set -eu

# Explicit commands (workers, beat, maintenance) must not start the web server.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# T17: schema mutation belongs to an explicit migration/bootstrap job.
# A normal web replica only receives the runtime DATABASE_URL and fails
# closed when the deployment forgot to apply required migrations first.
python manage.py migrate --check --no-input

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
