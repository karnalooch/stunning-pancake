#!/bin/sh
set -e

# Railway: set CELERY_WORKER_CONCURRENCY to match vCPUs (e.g. 6–7 on an 8 vCPU plan).
# Leave 1 CPU for OS / beat / broker overhead.
CONCURRENCY="${CELERY_WORKER_CONCURRENCY:-4}"
# simulation queue is handled by celery-worker-simulation service (see docs/RAILWAY_CELERY_SIMULATION.md)
QUEUES="${CELERY_WORKER_QUEUES:-critical,default,notifications}"

echo "Starting Celery worker: concurrency=${CONCURRENCY} queues=${QUEUES}"

exec celery -A core worker \
  --loglevel="${CELERY_LOG_LEVEL:-info}" \
  --queues="${QUEUES}" \
  --concurrency="${CONCURRENCY}" \
  --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-500}"
