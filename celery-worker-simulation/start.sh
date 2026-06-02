#!/bin/sh
set -e

# Dedicated worker for batch + live simulator (queue: simulation only).
# Railway: prefer 2 vCPU / 2 GB RAM, CELERY_WORKER_CONCURRENCY=2, pool=solo or prefork=2.
# High concurrency (6–7) + prefork duplicates Django memory → OOM SIGKILL (WorkerLostError).
CONCURRENCY="${CELERY_WORKER_CONCURRENCY:-2}"
QUEUES="${CELERY_WORKER_QUEUES:-simulation}"
HOSTNAME="${CELERY_WORKER_HOSTNAME:-simulation@%h}"
POOL="${CELERY_WORKER_POOL:-prefork}"
PREFETCH="${CELERY_WORKER_PREFETCH_MULTIPLIER:-1}"
MAX_TASKS="${CELERY_MAX_TASKS_PER_CHILD:-50}"

echo "Starting Celery SIMULATION worker: pool=${POOL} concurrency=${CONCURRENCY} prefetch=${PREFETCH} queues=${QUEUES} node=${HOSTNAME}"

if [ "$POOL" = "solo" ]; then
  exec celery -A core worker \
    --loglevel="${CELERY_LOG_LEVEL:-info}" \
    --hostname="${HOSTNAME}" \
    --queues="${QUEUES}" \
    --pool=solo \
    --concurrency=1 \
    --prefetch-multiplier="${PREFETCH}" \
    --max-tasks-per-child="${MAX_TASKS}"
fi

exec celery -A core worker \
  --loglevel="${CELERY_LOG_LEVEL:-info}" \
  --hostname="${HOSTNAME}" \
  --queues="${QUEUES}" \
  --concurrency="${CONCURRENCY}" \
  --prefetch-multiplier="${PREFETCH}" \
  --max-tasks-per-child="${MAX_TASKS}"
