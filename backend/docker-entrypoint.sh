#!/bin/sh
set -eu

python manage.py migrate --no-input
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
