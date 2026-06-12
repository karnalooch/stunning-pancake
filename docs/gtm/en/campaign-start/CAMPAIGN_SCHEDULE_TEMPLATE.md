# Campaign schedule — template

| | |
|--|--|
| **Campaign** | `[CAMPAIGN_NAME]` |
| **Start** | `[START_DATE]` |
| **End** | `[END_DATE]` |
| **Organizer** | `[TENANT_NAME]` |

---

## T-4 weeks (preparation)

| Task | Owner | Done |
|------|-------|------|
| DPIA + subprocessor list signed | Legal / DPO | [ ] |
| Tenant config (branding, season, disciplines) | Platform Operator | [ ] |
| Finalize campaign rules | Tenant admin | [ ] |
| Poster brief → designer | Tenant marketing | [ ] |
| App test with 3–5 people (GPS, join, leaderboard) | QA / captain | [ ] |

## T-2 weeks (communication)

| Task | Owner | Done |
|------|-------|------|
| Publish rules + FAQ on site / intranet | Tenant | [ ] |
| Posters in offices / city hall / club | Tenant | [ ] |
| Kickoff email #1 (announcement + app link) | HR / comms | [ ] |
| Social post + graphics | Marketing | [ ] |
| Moderator training (anti-cheat inbox) | Platform Operator | [ ] |

## T-1 week

| Task | Owner | Done |
|------|-------|------|
| Kickoff email #2 (GPS instructions + start date) | HR | [ ] |
| Burst protection / capacity check (if >1k participants) | Platform Operator | [ ] |
| Test push to registered users | Tenant admin | [ ] |

## T-0 — launch day

| Time | Action |
|------|--------|
| 08:00 | Push "Campaign is live!" |
| 08:00–20:00 | Monitor join rate, sessions, live map |
| All day | Support at `[SUPPORT_EMAIL]` — SLA <4 h |

**Peak RSP weekend:** see [RSP_WEEKEND_RUNBOOK.md](../operations/RSP_WEEKEND_RUNBOOK.md).

## T+1 week (mid-season)

| Task | Owner |
|------|-------|
| Push "Weekly ranking" / mid quest | Tenant |
| Participation % report (admin panel) | Tenant admin |
| Anti-cheat queue review | Moderator |

## T-end (final week)

| Task | Owner |
|------|-------|
| Push "X days left!" | Tenant |
| Reminder to complete GPS sync | Auto / email |
| Leaderboard freeze: `[END_DATE]` 23:59 | System |

## T+1 after end

| Task | Owner | Done |
|------|-------|------|
| Close season in panel (archive) | Tenant admin | [ ] |
| Final report (PDF ranking, fair-play) | Tenant admin | [ ] |
| Winners announcement + prizes | Tenant | [ ] |
| Retrospective with Platform Operator | Ops | [ ] |
