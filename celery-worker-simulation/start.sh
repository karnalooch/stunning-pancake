#!/bin/sh
set -e

# Dedicated worker for batch + live simulator (queue: simulation only).
# Railway: assign more vCPUs here (e.g. 8) and set CELERY_WORKER_CONCURRENCY=7.
CONCURRENCY="${CELERY_WORKER_CONCURRENCY:-7}"
QUEUES="${CELERY_WORKER_QUEUES:-simulation}"
HOSTNAME="${CELERY_WORKER_HOSTNAME:-simulation@%h}"

echo "Starting Celery SIMULATION worker: concurrency=${CONCURRENCY} queues=${QUEUES} node=${HOSTNAME}"

exec celery -A core worker \
  --loglevel="${CELERY_LOG_LEVEL:-info}" \
  --hostname="${HOSTNAME}" \
  --queues="${QUEUES}" \
  --concurrency="${CONCURRENCY}" \
  --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-200}"
