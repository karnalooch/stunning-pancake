#!/bin/sh
set -e

# Railway default worker (critical, default, notifications). Prefer solo + 4 GB RAM.
# Prefork + concurrency>1 duplicates Django heap → OOM SIGKILL on Hobby plans.
CONCURRENCY="${CELERY_WORKER_CONCURRENCY:-2}"
QUEUES="${CELERY_WORKER_QUEUES:-critical,default,notifications}"
POOL="${CELERY_WORKER_POOL:-solo}"
PREFETCH="${CELERY_WORKER_PREFETCH_MULTIPLIER:-1}"
MAX_TASKS="${CELERY_MAX_TASKS_PER_CHILD:-50}"

echo "Starting Celery worker: pool=${POOL} concurrency=${CONCURRENCY} prefetch=${PREFETCH} queues=${QUEUES}"

if [ "$POOL" = "solo" ]; then
  exec celery -A core worker \
    --loglevel="${CELERY_LOG_LEVEL:-info}" \
    --queues="${QUEUES}" \
    --pool=solo \
    --concurrency=1 \
    --prefetch-multiplier="${PREFETCH}" \
    --max-tasks-per-child="${MAX_TASKS}"
fi

exec celery -A core worker \
  --loglevel="${CELERY_LOG_LEVEL:-info}" \
  --queues="${QUEUES}" \
  --concurrency="${CONCURRENCY}" \
  --prefetch-multiplier="${PREFETCH}" \
  --max-tasks-per-child="${MAX_TASKS}"
