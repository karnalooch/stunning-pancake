# ADR-0003: Async Task Queue — Celery over Django Signals for Heavy Work

**Status**: Accepted  
**Date**: 2026-04-24  
**Author**: akarn  

---

## Context

Several operations in SPORT are computationally expensive or depend on external services with variable latency:

1. **BRouter validation** — HTTP call to the BRouter server (10–30s for long GPX tracks)
2. **Push notifications** — FCM/APNs delivery (network I/O, rate limits)
3. **Event progress aggregation** — DB aggregates across thousands of participations
4. **Activity Card generation** — Pillow image rendering (CPU-bound, 1–5s)

Initially, BRouter validation was implemented as a **Django Signal** (`post_save` on `Activity`). This blocks the API response thread and degrades throughput under concurrent load.

## Decision

We adopt **Celery 5.3 with Redis as broker** for all heavy background work.

Queue topology:
```
CRITICAL queue   → BRouter validation, event progress update
NOTIFICATIONS    → FCM push, email digests, Matrix alerts
DEFAULT          → everything else
```

Signals remain as the **trigger** (thin layer) that enqueues a Celery task, rather than executing logic inline:

```python
# signals.py — only enqueue
from activities.tasks import validate_activity_async
validate_activity_async.delay(instance.pk)

# tasks.py — execute in worker
@shared_task(queue='critical', max_retries=3)
def validate_activity_async(activity_id):
    ...
```

## Consequences

**Positive:**
- API endpoints are non-blocking — activity upload returns instantly.
- Worker concurrency is configurable independently of web workers.
- Failed tasks auto-retry with exponential backoff.
- Celery workers can be scaled horizontally by adding containers.

**Negative:**
- Eventual consistency: verification score is not available immediately after upload.
- Additional infrastructure component (Redis must be highly available).
- Task serialisation: models must be passed by PK, not instance, to avoid stale data.

## Migration Plan

Phase 7 introduces the infrastructure. Signal pipeline is kept synchronous until Celery worker is confirmed stable in staging. Feature flag `ASYNC_VALIDATION=True` in `.env` controls the switch.

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Django-RQ | Simpler but lacks canvas-style task routing and beat scheduler |
| Dramatiq | Good but less Django ecosystem support |
| Inline signals | Blocks API thread; unacceptable at >100 concurrent users |
