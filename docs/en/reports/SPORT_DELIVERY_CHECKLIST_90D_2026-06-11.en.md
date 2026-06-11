# 4VELO / SPORT — delivery checklist (90 days)

| | |
|--|--|
| **Status** | Active |
| **Date** | 2026-06-11 |
| **Owner role** | Product / Delivery Lead |
| **Audience** | Product team, sprint planning |
| **lang** | en |
| **translation** | [Polski](../../reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.pl.md) |
| **canonical_path** | docs/en/reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.en.md |
| **Full report** | [SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md) |

---

A delivery list ready to be transcribed directly into sprints. The order reflects priority (fast commercial proof → product → scale). Each item has an outcome ("done" criterion).

## How to read

- `[ ]` — to do.
- **Outcome** — what must be true for the item to be considered closed.
- Tiers 0–1b are the minimum for the first paid league / first local-gov contract.

---

## Tier 0 — GTM / trust (mostly documentation, week 1–3)

- [ ] Tenant "campaign start" package (posters, rules, GPS/battery FAQ, schedule).
  - Outcome: one folder of materials the tenant receives at onboarding.
- [ ] Public Anti-Cheat / Scoring Policy page.
  - Outcome: a URL with an explicit description of normalization and disqualification criteria.
- [ ] Peak-event runbook + a one-page simulation report (10k–300k).
  - Outcome: a document answering "what during an RSP weekend".
- [ ] DPIA template + subprocessor list per tenant.
  - Outcome: a ready template to sign with a city/company.
- [ ] In-app incident communication mechanism (not just email).
  - Outcome: a banner/message controlled from the backend.
- [ ] Pitch deck / one-pager PL and EN.
  - Outcome: ready to send to a decision-maker (based on the exec one-pager).

## Tier 1 — civic mobile product (week 2–7)

- [ ] CityHub on live API (instead of mocks), season sync.
  - Outcome: `CityHubScreen` shows real event data.
- [ ] "Pick city / department / team" onboarding (3 steps).
  - Outcome: a new user joins the competition without support.
- [ ] In-app "GPS problems" wizard (green/red checks).
  - Outcome: a battery/permissions/background diagnostic screen.
- [ ] Social sharing with ready-made graphics.
  - Outcome: one tap → an image with the result.
- [ ] Push: city ranking / quest / end of season.
  - Outcome: at least 3 types of retention notifications.
- [ ] Offline / poor coverage (outbox confirmation in production).
  - Outcome: an activity saved offline reaches the server after the network returns.

## Tier 1b — minimum for the first paid league (club/company, week 4–9)

Mobile:
- [ ] Club Detail + join + challenge accept (replace the `ClubsDirectoryScreen` placeholder).
  - Outcome: a user browses a club, joins, accepts a challenge.
- [ ] "My league" / Battle screen (You vs Them, progress bar, countdown).
  - Outcome: a 1v1 screen based on `ClubChallenge` / `CLUB_BATTLE`.
- [ ] Invite flow (link/code to a club or league).
  - Outcome: joining via a link without manual addition.
- [ ] Push "club losing by X km — N days left".
  - Outcome: a notification triggered by challenge state.

Admin:
- [ ] Season creator (name, dates, type 1v1/league, sport, normalization, publish).
  - Outcome: an organizer creates a season without developer support.
- [ ] Opponent invitation (status PENDING → ACTIVE like `ClubChallenge`).
  - Outcome: the other side accepts the challenge in the panel.
- [ ] End-of-season report (PDF: ranking, fair-play flags, participation %).
  - Outcome: one file to send to HR / a captain.

Trust:
- [ ] Public scoring policy wired to the season UI.
  - Outcome: a link to the policy visible at the competition.

## Tier 2 — TENANT_ADMIN (week 6–10)

- [ ] Export "mayor/HR report" (PDF/CSV: km, participants, heatmap, CO₂).
  - Outcome: one-click export.
- [ ] Heatmaps as premium value for the tenant (not only GO).
  - Outcome: a tenant with the package sees the heatmap.
- [ ] "Publish season / close season" workflow (draft → live → archive).
  - Outcome: a full season lifecycle with a final ranking.
- [ ] Playwright smoke as TENANT_ADMIN.
  - Outcome: a test covers the tenant admin path.
- [ ] Measure moderation <60s in production.
  - Outcome: a metric of time from report to decision.

## Tier 2b — scaling B2B (after the first pilots)

- [ ] SSO / SCIM for large companies.
- [ ] Multi-company league (organizer tenant + child tenants).
- [ ] Department leaderboard in mobile.
- [ ] "Captain" role (between user and moderator).
- [ ] Calendar integration (Outlook/Google) for season start/end.

## Tier 3 — GLOBAL_OWNER / platform (as multi-tenant grows)

- [ ] Action Inbox (pending + anti-cheat + infra + sim).
- [ ] Tenant Command Center (sparklines, churn signals).
- [ ] Impersonation + audit (support without raw SQL).
- [ ] GO-only feature flags.
- [ ] Separate prod vs sim on dashboards.

## Tier 3b — hardcore clubs (later)

- [ ] CHECKPOINT / ROUTE_MATCH events (club runs with POIs).
- [ ] KOM segments ("segment wars").
- [ ] Club Matrix chat in the UI (provisioning already exists).

## Deliberately out of the 90-day scope

- [ ] Full play-off bracket (only at 10+ leagues with play-offs).
- [ ] In-app entry-fee payments (contest/gambling regulation).
- [ ] Move-to-earn / crypto.
- [ ] All 18 disciplines like AM (start: 5–6 with good anti-cheat).

---

## Pilots (milestones)

- [ ] **Pilot A — internal company:** 4 departments, 6 weeks, one tenant.
  - Outcome: a closed season + HR report + zero manual developer intervention.
- [ ] **Pilot B — club 1v1:** two running clubs, 30 days.
  - Outcome: a finished duel with fair scoring + a case study.
- [ ] **Next step:** multi-company league (organizer tenant) based on pilot learnings.

---

## Source and scope

This checklist is derived from the recommendations in the [full report](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md) (sections 11–12) and does not introduce theses contradicting the report. Decision summary: [exec one-pager](./SPORT_EXEC_ONE_PAGER_2026-06-11.en.md).
