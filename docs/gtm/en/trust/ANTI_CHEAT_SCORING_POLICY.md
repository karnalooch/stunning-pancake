# Anti-Cheat and Scoring Policy — 4VELO

| | |
|--|--|
| **Status** | Active — public |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Last updated** | 2026-06-12 |
| **Owner** | Product / Trust |
| **Audience** | League participants, organizers, decision-makers |
| **lang** | en |
| **translation** | [Polski](../../pl/trust/ANTI_CHEAT_SCORING_POLICY.md) |
| **canonical_path** | docs/gtm/en/trust/ANTI_CHEAT_SCORING_POLICY.md |
| **Public URL** | `{admin-domain}/#/trust/anti-cheat` |

---

## 1. Scope

The 4VELO platform supports only three disciplines:

| Discipline | System type | Description |
|------------|-------------|-------------|
| Cycling | `BIKE` | Road, MTB, urban cycling |
| Running | `RUN` | Running, jogging |
| Nordic walking | `WALK` | Nordic walking (poles); classified as walking with speed validation |

Activities outside this scope are not supported in 4VELO campaigns and leagues.

---

## 2. Score normalization (scoring)

Leaderboards may use **normalization** to compare participants with different fitness levels and conditions:

- Base score comes from verified GPS distance (or imported source with appropriate flag).
- Campaign organizer (tenant) may enable a per-participant normalization factor (e.g. fitness profile).
- **Internal formula details are not published** — this prevents intentional gaming of the system.
- For prize leagues, only activities with **verified** status (`is_verified=true`) count by default.

---

## 3. Anti-cheat system — four layers

Every activity passes automatic verification in layers:

| Layer | What it checks | Detection examples |
|-------|----------------|-------------------|
| **1 — Kinematic gate** | Physically impossible movement | Teleport >500 m, acceleration >6 m/s², constant speed (CV <5%), straight line >92% |
| **1.5 — ML anomalies** | Statistical patterns atypical for humans | Unnatural speed distribution, segments, time ratios |
| **2 — Speed limits (V-max)** | Maximum speed per discipline | RUN 12 m/s (~43 km/h) · BIKE 25 m/s (~90 km/h) · WALK 3.5 m/s (~12.6 km/h) |
| **3 — Route validation** | Route vs road/path network | Unroutable track, large GPS vs topology distance mismatch |
| **4 — Verification score** | Combined trust score 0–1 | Low score → moderation queue or rejection |

Additionally **forensics** (batch analysis): duplicate route fingerprint, metadata distance mismatch, wearable import (Strava/Garmin), simulated activity.

---

## 4. What disqualifies or flags an activity

### Automatic rejection (hard reject)

- Speed exceeding V-max for the discipline (repeated or sustained).
- GPS point teleportation (location jump without physical travel).
- Route impossible to ride/run (e.g. motorway where cycling is not allowed).
- Duplicate route (same fingerprint across accounts or events).
- Activity marked as simulation/test.

### Moderation flag (soft flag)

- Import from external source (Strava/Garmin) — may have lower weight in prize leaderboards.
- Suspected nordic walking vs running (long segments >4 m/s with WALK type).
- Low `verification_score` without clear hard reject.
- Unusual but possible speed profile (e.g. downhill).

### Prohibited behaviour (league rules)

Regardless of automation, **campaign rules** prohibit:

- Motor vehicle travel with GPS enabled.
- Location spoofing (fake GPS apps).
- Submitting someone else's GPX file or route recording.
- Account sharing ("mule") to artificially inflate distance.
- Rewarding activities inconsistent with the selected discipline.

For material prizes, the organizer may require additional moderator verification.

---

## 5. Activity status in the app

| Status | Meaning for participant |
|--------|-------------------------|
| **Verified** | Activity counts toward leaderboard |
| **In queue** | Automatic or manual verification in progress |
| **Rejected** | Does not count; reason available in training history |
| **Flagged** | Visible with caveat; moderator decision pending |

If your route was rejected, check: no motor vehicle, GPS did not "jump", route matched roads (cycling). GPS FAQ: [campaign-start/FAQ_GPS_BATERIA.md](../campaign-start/FAQ_GPS_BATERIA.md).

---

## 6. Appeal process

1. **Submit** — in app (activity details → "Submit appeal") or email to tenant / platform operator support.
2. **Required information** — date, discipline, brief description (e.g. "downhill", "GPS in tunnel").
3. **Review** — moderator checks metrics (average speed, profile, forensics flags). **We do not publish public cheating accusations** in league chats.
4. **Decision** — restore activity · uphold rejection · warning · event exclusion (for repeat violations).
5. **Target SLA** — first response within **5 business days**; final decision within **10 business days** of complete submission.

Tenant moderator operational target: **<60 s** to review a single case in the panel (when data is available).

---

## 7. Moderator vs automation

| Element | Automation | Moderator |
|---------|------------|-----------|
| V-max / teleport rejection | Yes | Can reverse (false positive) |
| Anti-cheat SOC queue | Prioritized by `verification_score` | Review and decision |
| Strava/Garmin import | Default flag | Can accept with justification |
| Disputes between participants | — | Decision per rules + data |
| Event / account ban | Per auto_ban rule (if enabled) | Always available manually |

Platform operator (GLOBAL_OWNER) has access to full moderation audit log.

---

## 8. External integrations

Import from **Strava** or **Garmin** is technically allowed, but:

- Imported activity may be **flagged** (`wearable_imported`).
- In prize leagues, organizer may require **native GPS from the 4VELO app** for leaderboard eligibility.
- Import does not bypass anti-cheat layers — metadata and route fingerprint are still analyzed.

---

## 9. Policy updates

Threshold or scope changes are published with **at least 7 days' notice** before a new season starts. Ongoing campaigns use the version effective on season start date.

**Version:** 1.0 · **Date:** 2026-06-12

---

*Related: [ONE_PAGER.md](../ONE_PAGER.md) · [CAMPAIGN_RULES_TEMPLATE.md](../campaign-start/CAMPAIGN_RULES_TEMPLATE.md) · [SPORT_CHEATING_ATHLETES_REPORT](../../../en/reports/SPORT_CHEATING_ATHLETES_REPORT_2026-06-11.en.md) (internal analysis).*
