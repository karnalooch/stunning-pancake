# Scale proof — one-page report

| | |
|--|--|
| **Status** | Active |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Owner** | Platform Operator |
| **Audience** | Local gov / HR decision-maker, investor |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/SCALE_PROOF_ONE_PAGER.md) |
| **canonical_path** | docs/gtm/en/operations/SCALE_PROOF_ONE_PAGER.md |

---

## Verdict (TL;DR)

| | |
|--|--|
| **Platform** | 4VELO SPORT |
| **Test scope** | Simulations 1k → 300k users, burst protection, global load guard |
| **Market context** | Aktywne Miasta — failure at ~150k sessions (2024) |
| **Conclusion** | Architecture ready for municipal/corporate campaign peak under operational conditions below |

---

## Scale tiers

| Target users | Cities × users | Batch PG chunk | Live pool | Disk (~) |
|--------------|----------------|----------------|-----------|----------|
| **1k** | ~3–10 × ~100–350 | 200–500 | Full Redis | ~0.03 GB |
| **10k** | 10 × ~1k | 500–600 | Redis cap 50k | ~0.3 GB |
| **50k** | — | burst auto | Event burst + global guard | operational target |
| **100k** | 10 × ~10k | 350–400 | DB sampling | ~3.3 GB |
| **300k** | 10 × ~30k | 100–250 | DB sampling | ~10 GB |

Source: [SCALE_TEST_300K.md](../../../pl/SCALE_TEST_300K.md). Preflight API: `GET /api/activities/admin/scale-preflight/?target_users=N`.

---

## What we tested

| Area | Method | Result |
|------|--------|--------|
| Batch user seed | `simulate_active_cities.py` to 300k | Sub-chunked bulk_create; adaptive PG batch |
| Live sim + routing | Celery + Redis backpressure | Stable drain ~1.3–1.8 s/route at cap |
| Burst joins/sessions | `EVENT_BURST_MODE=auto` | 429 + Retry-After vs thundering herd |
| Global protection | `load_guard.py` always-on | Fail-open; caps 8k join/min, 20k ingest/s |
| Map under load | LOD H3/meso + micro markers | No random subsampling at `LIVE_MAP_FULL_SCALE=1` |

---

## SLO (reference thresholds)

From `scripts/load/thresholds.json`:

| Tier | Ingest pos/s min | Map p95 max | Error rate max |
|------|------------------|-------------|----------------|
| smoke | 500 | 3000 ms | 5% |
| baseline | 5000 | 1000 ms | 1% |
| stress-50k | 45000 | 300 ms | 0.1% |
| soak 30 min | 10000 | 500 ms | 0.1% |

**[TO COMPLETE AFTER RUN]** — controlled 10k staging test: run date ______, verdict PASS/FAIL.

---

## Root cause fixes (300k Railway lessons)

| Problem | Fix |
|---------|-----|
| Postgres `No space left on device` on bulk_create | PG batch 100–250; volume ≥10 GB |
| Celery tick OOM at 300k SMEMBERS | DB sampling vs full Redis pool |
| Redis live pool at 90k rides | Cap + DB sampling ≥100k |

---

## Market comparison

| Platform | Peak | Outcome |
|----------|------|---------|
| Aktywne Miasta | ~150k sessions | Outages, trust loss |
| 4VELO (architecture) | Test to 300k (batch) + 50k concurrent target | Burst + guard + simulator |

---

## Operational conditions (decision-maker checklist)

- [ ] Postgres ≥10 GB for campaigns >50k participants
- [ ] Burst mode `auto` (default — no manual event-day config)
- [ ] Pushes spread over time (not single 8:00 blast)
- [ ] Platform Operator on-call first campaign weekend
- [ ] Runbook: [RSP_WEEKEND_RUNBOOK.md](./RSP_WEEKEND_RUNBOOK.md)

---

**Document version:** 1.0 · **2026-06-12**
