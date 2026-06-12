# Runbook — peak campaign weekend (RSP-weekend)

| | |
|--|--|
| **Status** | Active |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Owner** | Platform Operator |
| **Audience** | Local gov decision-maker, Platform Operator, Tenant admin |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/RSP_WEEKEND_RUNBOOK.md) |
| **canonical_path** | docs/gtm/en/operations/RSP_WEEKEND_RUNBOOK.md |
| **Technical runbooks** | [EVENT_BURST_50K.md](../../../pl/EVENT_BURST_50K.md) · [SCALE_TEST_300K.md](../../../pl/SCALE_TEST_300K.md) |

---

## What is it?

**RSP-weekend** = first weekend of mass campaign launch (pattern: seasonal city campaigns — May–June). Thousands of users simultaneously: open app, join event, start GPS sessions.

**Decision-maker question:** "What happens when 10k–50k people start on Saturday morning?"

**Short answer:** Platform has **two protection layers** (global load guard + event burst), join stagger, session queuing and LOD map — designed after competitor failure analysis (~150k AM sessions) and own scale tests.

---

## Before the weekend (T-7 to T-1)

| # | Action | Owner | Done |
|---|--------|-------|------|
| 1 | `GET /api/activities/admin/scale-preflight/?target_users=N` — check `estimated_disk_gb`, `live_pool_mode` | Platform Operator | [ ] |
| 2 | Participants ≥1000 → burst protection **automatic** (`EVENT_BURST_MODE=auto`) | System | auto |
| 3 | Confirm Postgres volume ≥10 GB (campaigns >50k) | Platform Operator | [ ] |
| 4 | Tenant: spread push schedule (not all at 8:00) | Tenant admin | [ ] |
| 5 | Moderators: anti-cheat queue — pre-week false positive review | Tenant | [ ] |
| 6 | DPIA and rules published | Tenant | [ ] |

---

## During the weekend (T-0)

### Layer 1 — Global load guard (always on)

Protects platform **regardless of event** — viral spike, unscheduled mass start.

| Signal | Default cap | Effect when exceeded |
|--------|-------------|----------------------|
| Joins / min | 8000 | 429 + Retry-After |
| Session starts / min | 5000 | 429 + Retry-After |
| Telemetry ingest / s | 20000 | 429 + Retry-After |
| Concurrent riders | 50000 | Concurrent session limit |

### Layer 2 — Event burst (per event)

| Scenario | Behaviour |
|----------|-----------|
| 50k app opens | Join rate capped (~5k/min per event when burst active) |
| 50k session starts | Stagger ~3k/min; excess queued with Retry-After |
| 50k parallel GPS | Target `EVENT_MAX_CONCURRENT_RIDERS=50000`; LOD map (H3/meso) |

### Monitoring (Platform Operator)

| Metric | Where | Alert if |
|--------|-------|----------|
| `routing_queue_depth` | Dashboard / live-simulate | Continuous backpressure >15 min |
| `loadguard.engaged` | Railway logs | All signals engaged >5 min |
| Celery worker OOM | Railway logs | Restart loop |
| Map API p95 | Telemetry | >2 s viewport |
| Join 429 rate | API logs | >5% requests |

### Participant communication

| Situation | Channel | Message template |
|-----------|---------|------------------|
| Delayed session start (429) | In-app / push | "High load — retry in 30 s. Your activity is not lost." |
| Planned maintenance | In-app banner + email | `[Tier 2 iteration — BE banner]` |
| Security incident | Email + banner | Escalate to tenant DPO |

**Goal:** participant knows system **does not lose GPS** (mobile outbox) even with temporary 429.

---

## Escalation

| Level | Condition | Action | Contact |
|-------|-----------|--------|---------|
| L1 | Single 429, backpressure <15 min | Monitor | Platform Operator on-call |
| L2 | Backpressure >15 min or map p95 >3 s | Temporarily raise cap / spread pushes | Platform Operator + Tenant |
| L3 | Worker OOM, DB disk >90% | Pause live sim, scale workers, tenant comms | GLOBAL_OWNER |
| L4 | Data loss / breach | GDPR incident + DPO | Legal |

---

## After the weekend (T+1)

| Action | Owner |
|--------|-------|
| Report: peak joins, 429 count, max concurrent riders | Platform Operator |
| Tenant retrospective (30 min) | Customer Success |
| Update [SCALE_PROOF_ONE_PAGER.md](./SCALE_PROOF_ONE_PAGER.md) if controlled load test run | Platform Operator |

---

## One-sentence verdict for decision-maker

**At RSP-weekend the platform degrades gracefully** (queues, 429, stagger) instead of crashing — unlike documented competitor failures at similar scale.
