# SPORT / 4VELO — full market and GTM report

| | |
|--|--|
| **Status** | Active (strategic snapshot) |
| **Date** | 2026-06-11 |
| **Owner role** | Product / Strategy |
| **Audience** | Founder, Product, Sales, Strategy |
| **lang** | en |
| **translation** | [Polski](../../reports/SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md) |
| **canonical_path** | docs/en/reports/SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md |

---

## 0. Purpose

Consolidated, complete report from a strategic session on the **4VELO / SPORT** platform. It combines:

- competitor research (Poland and Europe),
- community signals (Reddit, Wykop, Facebook),
- the **Aktywne Miasta** benchmark,
- analysis of the existing 4VELO codebase,
- sales strategy for clubs and companies (1vs1 and league models),
- product and go-to-market recommendations.

The scope is a reference point for further product and sales decisions. Most market figures come from public materials, local press and communities — not proprietary competitor data.

---

## 1. 4VELO product context

A **multi-tenant B2B/B2C** platform: GPS tracking, anti-cheat, white-label, city and corporate competitions, operator console.

Confirmed traits in the repository and documentation:

- multi-tenant + white-label (`Tenant`, per-tenant branding and config, `config_json`, heatmap toggle),
- event engine supporting many competition formats (`ACCUMULATIVE`, `CHECKPOINT`, `ROUTE_MATCH`, `INTER_TENANT`, `CLUB_BATTLE`),
- clubs and direct duels (`Club`, `ClubMembership`, `ClubChallenge`),
- score normalization (fair scoring across group sizes),
- departments/teams within tenants (`Department`) as the basis for company leagues,
- anti-cheat (4 layers) and data resilience (MMKV/outbox, NetInfo recovery),
- scale simulations (`simulate_active_cities.py`, 10k–300k tests),
- Strava + Garmin integrations,
- overhaul plans for the GLOBAL_OWNER and TENANT_ADMIN panels (control-plane direction),
- mobile "game vibe" (quests, grades, LLM coach).

Baseline conclusion: **the backend is far more mature than the mobile UX for clubs and leagues, and than the sales (GTM) package.**

---

## 2. Competitor segments

| Segment | Examples | Basis of competition |
|---------|----------|----------------------|
| Fitness / wellness challenges | YuMuuv, Wellhub Challenges, StepJockey | Wearable integration, gamification, team challenges |
| Community / collective challenges | MileStack, Baton, Movva, Stride | Group goals, leaderboards, 1v1 with stakes |
| Municipal | Aktywne Miasta, STADTRADELN, Love to Ride, Naviki, Geovelo, Da's zo gefietst, Liikkuen | Km for the city/municipality, heatmaps, seasonal campaigns |
| Corporate wellness | Activy, MoveSpring, Tappa, Wellstep, Step Up | Steps, teams, HR report |
| Polish competition layer | Stravit, Mistrzowie Rywalizacji | Strava-based competitions, medals, B2B |
| Clubs / fan engagement | Clupik, HUDDLE | Club management, leagues, communication |
| White-label enterprise | dacadoo, District Technologies, Wellness360 | API, multi-tenant, insurers/corporations |

---

## 3. Community signals (Reddit / Wykop / Facebook)

### Reddit and English-language forums

1. **Cheating in corporate step challenges** — the number-one topic. A widely cited case: a coworker reports ~65,000 steps in a work day (manually converting other activities into "steps"); the organizer did not disqualify, so the cheater won. Comments: "nobody cared", frustration of honest participants.
2. **Strava** — complaints about the paywall and subscription prices, sync issues, the app being killed in the background (Android/MIUI).
3. **Corporate apps** (MoveSpring, YuMuuv) — sync issues (Apple Health, OAuth reconnect).

### Wykop (PL)

- problems with apps running in the background (GPS, battery),
- **Stravit.app** as a cheaper Polish alternative for Strava-based competition (B2B cheaper than ~50 PLN/person),
- skepticism toward "earn for walking" models.

### Facebook (PL)

- subscription scams and fake "sports contests",
- challenge communities running on Excel + FB/Discord groups (e.g. virtual races with medals).

### Conclusion

The biggest pain is not a lack of features, but **lack of trust in results** (cheating, no enforcement of rules) and **tracking instability**. "Fair play + transparent rules + stability" is worth more than another marketing layer.

---

## 4. Benchmark: Aktywne Miasta (Poland)

| | |
|--|--|
| Owner | City of Bydgoszcz (municipal, non-commercial project) |
| App | Android + iOS, free |
| Origin | Aktywna Bydgoszcz → Rowerowa Stolica Polski (2019) → Aktywne Miasta (2021) |
| Position | Closest Polish equivalent to 4VELO in the city/municipality competition segment |

### Features

- 18 disciplines, GPS, map, time, distance, calories, charts,
- Garmin Connect integration,
- competitions: Rowerowa Stolica Polski (June), Aktywny Wrzesień, city games; municipalities since 2023,
- motivation: coins → partner discounts, badges, records,
- community: social sharing, invites,
- for local government: city/municipality rankings, heatmaps, web portal.

### Problems (documented)

| Problem | Evidence / scale |
|---------|-------------------|
| Server overload at peak | RSP: ~150k app launches, server crashed over a long weekend; 1000+ complaints about missing km (Express Bydgoski) |
| Data loss after reinstall | Reinstall = no route recovery |
| Background app / GPS | Same pattern as Strava on Android (MIUI) — process killing |
| Data leak 2021 | External subcontractor server; email, city, stats (Gazeta Pomorska) |
| Poor incident communication | Email to spam, no visible in-app message |
| Anti-cheat | No public policy; abuse risk with prizes |
| Single-city dependency | Infrastructure and brand = Bydgoszcz |
| Limited integrations | No Strava/Apple Health as standard |

### Conclusion

AM confirms demand and segment scale, but reveals gaps: **peak resilience, a visible fair-play model, enterprise operability, white-label.**

---

## 5. European landscape

### 5.1 European Cycling Challenge (ECC) — archived, origin of AM

- Started Bologna 2012, May format, city vs city, GPS via Naviki/Cycling365.
- 2016 peak: 52 cities, 18 countries, 46k participants, 4M km; **Gdansk** 2x champion.
- No active ECC since ~2017; Bydgoszcz withdrew and built its own AM/RSP.
- Lesson: proven demand for a city league, collapsed on the lack of a durable operator platform — a slot for white-label SaaS.

### 5.2 STADTRADELN / CITY CYCLING (Germany → Europe)

- Operator: Climate Alliance (Klima-Bündnis), thousands of municipalities globally.
- Format: 21 days, teams collect km for the municipality.
- IT for local government: municipality subpages, dedicated app, RADar! (reporting route problems), BIKE Monitor (heatmaps/analysis).
- Problems: background GPS (FAQ "turn off battery saving"), 2022 data breach (ACL bug, municipality coordinators could download other municipalities' data), GDPR complexity (joint controllers), single brand, cycling only, campaign rather than year-round product.
- Most mature B2G model for cycling, weaker as a sports platform and white-label.

### 5.3 Love to Ride (UK → global)

- 750k+ users, 250+ regions, 12 countries.
- B2G "Ride 365" model (4 campaigns/season), own app + Strava/Garmin/MapMyRide, route rating for councils, partner kit (ready-made social posts, reports).
- Problems: Strava sync up to 24h delay, no indoor sync, OAuth reconnect, auto-log failing on some devices (OPPO, battery drain), UI/UX, no anti-cheat, single global brand.
- Best B2G go-to-market and integrations in the cycling segment; weak native reliability and fair play with prizes.

### 5.4 Naviki Contests (Germany / EU)

- Contest inside the Naviki navigation app; per-municipality config (GIS shapefile, groups, categories).
- Anti-fraud: speed thresholds (max avg 25 km/h, max 50 km/h, max 100 km) — basic, GPS spoofing still possible.
- Manual B2B onboarding, cycling only, dependence on the Naviki ecosystem.

### 5.5 Geovelo + Mai à Vélo (France)

- National Mai à Vélo challenge (May), communities (municipality/company/school) inside the navigation app.
- Problems: two systems in parallel (Geovelo + STADTRADELN = chaos), cycling focus, no game/anti-cheat.

### 5.6 Da's zo gefietst (Netherlands, 2025+)

- National app (6 provinces + ministry) replacing regional ones; auto-tracking, points/rewards, team challenges.
- Smart-city: traffic-light priority, mobility dashboard for municipalities.
- Most modern EU model for urban data + behavior; NL-only, cycling, no sports gamification.

### 5.7 Liikkuen läpi vuoden (Finland)

- Municipality network, 3 campaigns/season, real-time municipality ranking, multi-sport outdoor, paper card for seniors.
- Functionally closest to AM (multi-sport + municipality league), but regional and technologically simpler.

### 5.8 Healthy Cities (PL / LUX MED)

- June, min. 6000 steps/day, city + company in parallel, eco narrative.
- Steps only, single brand, weak anti-cheat, 1-month season.

### 5.9 Corporate wellness (B2B context)

| Platform | Features | Problems |
|----------|----------|----------|
| MoveSpring | Steps, teams, Google Fit | Apple Health sync, reconnect |
| Activy (PL) | Steps, CO₂, charity | B2B price, weak anti-cheat |
| YuMuuv | Multi-activity, 47 languages, wearables | Narrow wellness, no native rewards |
| Tappa (SE) | Virtual Nordic routes | Corporate, not municipal |
| dacadoo (CH) | White-label, 18 languages, 120+ activities | Enterprise sales cycle, not local government |

---

## 6. Feature comparison matrix

| Feature | AM | STADTRADELN | Love to Ride | Naviki | Geovelo | Da's zo gefietst | Liikkuen | 4VELO |
|---------|:--:|:-----------:|:------------:|:------:|:-------:|:----------------:|:--------:|:-----:|
| City vs city | ✓ | ✓ | ○ | ○ | ✓ | ○ | ✓ | ✓ |
| Multi-sport | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Own GPS tracking | ✓ | ✓ | ○ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Strava sync | ✗ | ✗ | ✓ | ✗ | ? | ✗ | ✗ | ✓ |
| Garmin | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Heatmaps for local gov | ✓ | ✓ | ○ | ✓ | ○ | ✓ | ○ | ✓ |
| White-label | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Anti-cheat tech | ✗ | ✗ | ✗ | △ | ✗ | ✗ | ✗ | ✓ |
| Scale tested 100k+ | ✗ | ? | ? | ✗ | ✗ | ? | ✗ | ✓ |
| ARPG gamification | ✗ | ✗ | △ | ✗ | ✗ | △ | ✗ | ✓ |
| Multi-tenant admin | ✗ | △ | △ | ✗ | ✗ | △ | ✗ | ✓ |
| LLM coach | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Rewards / coins | ✓ | △ | ✓ | ✗ | ✗ | ✓ | △ | ✓ |
| GDPR / audit | △ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (RLS) |

Legend: ✓ strong · ○ partial · △ basic · ✗ none

---

## 7. Recurring industry problems and market responses

| Problem | Who has it | Typical response | Effectiveness |
|---------|-----------|------------------|---------------|
| Peak load / server crash | AM, ECC (hist.) | Manual recovery, infra rebuild | Low — reactive |
| Background GPS (Android) | AM, STADTRADELN, Strava, Love to Ride | FAQ "turn off battery saving" | Medium — burdens the user |
| Wearable sync | Love to Ride, MoveSpring | OAuth reconnect, 24h delay | Medium |
| Data leak / ACL | AM 2021, STADTRADELN 2022 | Regulator, email, patch | One-off, trust drops |
| Ranking cheating | All without tech anti-cheat | Rules, community flagging | Low with prizes |
| App fragmentation | FR (Geovelo+STADTRADELN), ECC | Two parallel systems | Poor UX |
| Single foreign brand | STADTRADELN, Love to Ride, HC | Municipality accepts or builds own | Political, not tech |
| Seasonality | Most | 21–31 day campaigns | OK for PR, weak for retention |
| Seniors / inclusion | Liikkuen | Paper card | Good niche |

---

## 8. Market gaps (4VELO advantage)

No player combines all of:

1. white-label multi-tenant SaaS,
2. multi-sport + gamification,
3. technical anti-cheat (4 layers),
4. mobile resilience and scale-tested backend,
5. multi-tenant operator console (impersonation, health, audit).

Closest: STADTRADELN (B2G scale, but DE-centric, single brand, cycling), Love to Ride (mature B2G, cycling), Da's zo gefietst (urban data, NL-only), Liikkuen (multi-sport + municipality league, regional).

### 4VELO positioning against market requirements

| Market requirement | 4VELO answer |
|--------------------|--------------|
| City / tenant league | Multi-tenant, `simulate_active_cities.py`, CityHub (planned) |
| RSP-like peak load | Simulator 10k–300k, Celery, Redis |
| Background GPS loss | MMKV buffer, outbox, NetInfo recovery |
| Fair rankings | 4-layer anti-cheat + BRouter |
| Strava/Garmin ecosystem | OAuth + sync (better than AM) |
| White-label for local gov | Remote Asset Injection, per-tenant branding |
| GDPR / isolation | PostgreSQL RLS |
| Operator data | Control plane (health, audit) — overhaul |
| Retention / engagement | Game vibe, quest grades, LLM coach |
| B2G marketing kit | **Gap to build** |

---

## 9. Selling to clubs and companies (1vs1 and leagues)

### 9.1 Two sales models — not one

| | Companies (B2B wellness / HR) | Sports clubs |
|--|-------------------------------|--------------|
| Buyer | HR, wellbeing, CSR | Club president/secretary, captain |
| Competition unit | Department, branch, whole company | Club, team, age category |
| Format | Internal league or company vs company | Club vs club, seasonal league |
| Metric | Normalized km / activity / steps+GPS | km, segments, checkpoints, matches |
| Competition | Activy, YuMuuv, MoveSpring, Step Up | Stravit, Clupik, amateur leagues (Excel) |
| 4VELO edge | Anti-cheat + white-label + departments in admin | Anti-cheat + game vibe + 1v1 in API |
| Risk | "We already have Activy for steps" | "We have WhatsApp + Strava" |

Do not mix in one pitch: a company buys integration and an HR report; a club buys prestige, fair results and simplicity for members.

### 9.2 What already exists in the backend

- **`Tenant`** ([backend/users/models.py](../../../backend/users/models.py)) — white-label for a company/league organizer (colors, logo, `max_users`, heatmaps, Stripe).
- **`Department`** ([backend/users/departments.py](../../../backend/users/departments.py)) — departments/classes/teams as the basis for an in-company league (types: department, class, faculty, team, district).
- **`ClubChallenge`** ([backend/clubs/models.py](../../../backend/clubs/models.py)) — 1v1 club vs club duel; winner by normalized score `total_km * complexity_factor / active_members`.
- **Club API** ([backend/clubs/views.py](../../../backend/clubs/views.py)) — `/api/clubs/`, join/leave, `/api/clubs/challenges/`.
- **Event types** ([backend/events/models.py](../../../backend/events/models.py)) — `ACCUMULATIVE`, `CHECKPOINT`, `ROUTE_MATCH`, `INTER_TENANT` (city/company vs company), `CLUB_BATTLE`.
- **Normalization** ([backend/events/services.py](../../../backend/events/services.py)) — `EventProgressService` + `EventNormalizationService` (`Score = Total Group KM × Complexity Factor / Active Participants`).
- **Anti-cheat + moderation** — differentiator for leagues with prizes/prestige.

### 9.3 What is weak (UX/mobile)

- `ClubsDirectoryScreen` ([mobile/src/screens/ClubsDirectoryScreen.tsx](../../../mobile/src/screens/ClubsDirectoryScreen.tsx)) — placeholder (title + subtitle).
- `CityHubScreen` ([mobile/src/screens/CityHubScreen.tsx](../../../mobile/src/screens/CityHubScreen.tsx)) — exists (City Wars UI), needs wiring to live API.
- STITCH mockups (Clubs, ClubDetail, ClubChallenges, MyClubs, Global Leaderboard) — Phase 2 in the mobile plan.

### 9.4 Mapping formats to the product

**Model A — 1vs1 (duel)**

| Scenario | Mechanism |
|----------|-----------|
| Club A vs Club B (30 days) | `ClubChallenge` or `Event` of type `CLUB_BATTLE` |
| Company X vs Company Y | `Event` of type `INTER_TENANT` + `opponent_tenant_id` |
| Marketing dept vs IT | `Event` scoped to tenant + ranking per `department_id` |
| Two friends | Smaller event / private challenge (thin "invite link" UI) |

**Model B — League (many participants)**

| Scenario | Mechanism |
|----------|-----------|
| 8 clubs, autumn season | One `ACCUMULATIVE` `Event` + club table (aggregation per club_id) |
| 12 companies in an HR group | Multi-tenant: each company = tenant, organizer-federating event |
| 20 departments in a corporation | One tenant, leaderboard per department |
| 1v1 play-off after group phase | Phase 1 ACCUMULATIVE → Phase 2 `ClubChallenge` pairs |

Backend gap: no explicit "League season" model (round, fixture, promotion). Today it is composed of `Event` + `ClubChallenge`. Sufficient for a start, but for enterprise a single "Season" entity in the admin UI is worth adding.

**Model C — Hybrid (most common for companies)**

- Group phase: sum of department km,
- final: top 2 departments 1v1 in the last week.
- A natural time-based upsell (2 events or 1 event with phases in `config_json`).

### 9.5 Competition in the segment

| Player | 1v1 / leagues | GPS / anti-cheat | White-label | 4VELO edge |
|--------|---------------|------------------|-------------|------------|
| Activy / YuMuuv | Corporate step leagues | Weak | Co-branding | GPS + fair play with prizes |
| Stravit | Strava-based competition | None | No | Own tracking + admin + anti-cheat |
| MoveSpring / Step Up | Steps, teams | None | Limited | "Real" sport, not shake-phone |
| Brakto / Volo | Corporate tournaments (offline) | N/A | Yes | Digital tracking + verification |
| Clupik / HUDDLE | Clubs, leagues, communication | Not a focus | Yes | Gamification + telemetry |
| Movva / Stride | 1v1 with stakes | Weak | No | B2B without gambling, with moderation |

4VELO niche: **verified running/cycling leagues for companies and clubs, where the result matters** (prize, trophy, promotion).

### 9.6 Club/company segment problems

1. Cheating (shake-phone in companies, GPS in a car in clubs) — without anti-cheat HR loses credibility.
2. Unfair scoring (large department always wins) — normalization must be understandable ("average km per active member").
3. Adoption — the captain does not want another app; Strava sync + a simple invite link.
4. Captain / league admin — someone has to create matches; without self-serve UI they email support.
5. Seasonality — a 6-week league, then churn; need "next season" in 1 click.
6. GDPR in companies — DPO asks about employee GPS; work vs private mode or clear consent.
7. Amateur clubs — often no SaaS budget; "organizer pays" model (company/sponsor/federation), members free.

### 9.7 Sales packages

1. **Company — internal league**: 1 tenant, up to 500 employees, N departments, 1 season (~6 weeks), department ranking + normalization, HR report. Flat/season price (Activy ~750 EUR / 45 days as a reference point; higher for 4VELO thanks to GPS+anti-cheat).
2. **Company vs company**: 2 tenants (or 1 organizer + 2 participants), `INTER_TENANT`, shared rules, separate brandings. Ideal: sister companies, client-partners, trade fairs.
3. **Club — 1v1 season**: clubs as `Club` (tenant optional, e.g. sponsor city), up to 5 parallel duels or a 6–10 club league. Lower price, higher volume; upsell: a federation pays for a regional league.
4. **League organizer** (HR agency, federation): multi-tenant under one GO, white-label "Małopolska Runners League". Long-term sweet spot — like STADTRADELN, but paid B2B and multi-sport.

### 9.8 One-sentence pitch

- **For a company:** "A department or company running/cycling league with results HR can trust — because we cut out cheating, and a small team still has a chance thanks to fair scoring."
- **For a club:** "Club vs club like Rowerowa Stolica, but for your running/MTB club — your own league, medals in the app, no manually collecting Strava screenshots."

### 9.9 Difference vs selling to cities

| | Cities (local gov) | Companies / clubs |
|--|--------------------|-------------------|
| Decision | Mayor, sports department | HR / club board |
| Scale | 10k+ users, peak | 50–2000 typically |
| Peak load | Critical (RSP) | Moderate |
| GTM | Seasonal campaign, PR | Quarterly season, wellbeing ROI |
| Product | CityHub, heatmaps, municipalities | Clubs, departments, 1v1, HR report |
| Competition | AM, STADTRADELN | Activy, Stravit, Excel |

One platform — a tenant can be a city, company or league organizer; packaging and UI entry point change, not the core backend.

---

## 10. What is worth knowing (strategic context)

1. The market does not buy a "sports app" — it buys a package (campaign + marketing + report + data). Without a B2G playbook, 4VELO wins on slides and loses in the tender.
2. Peak load is a proven killer (AM crashed at ~150k sessions). The simulator is worth selling as proof (load-test report + SLA).
3. GDPR after AM/STADTRADELN incidents: DPIA, subprocessors, in-app message (not just email), joint-controller agreement template.
4. Anti-cheat is a USP only if visible — a public policy is needed (template: Anti-Cheat Policy page).
5. ECC is dead, but the city-league formula (May/June) is still expected — a window for a "successor with better tech".
6. Integration fragmentation is the norm — the "works immediately" edge (Strava + Garmin + native GPS in one flow).
7. Seasonality vs retention — game vibe + quests + CityHub must be wired to the season calendar.

---

## 11. What to implement — priorities

### Tier 0 — before the first contract (GTM, mostly documentation)

1. Tenant "campaign start" package (posters, rules, GPS/battery FAQ, schedule).
2. Public Anti-Cheat / Scoring Policy page.
3. Peak-event runbook + a one-page simulation report.
4. DPIA template / subprocessor list per tenant.
5. In-app incident communication.
6. Pitch deck / one-pager PL (and EN).

### Tier 1 — mobile product (vs AM, Love to Ride)

1. CityHub on live API (no mocks), season sync.
2. "Pick city / department / team" onboarding (simplicity like AM).
3. In-app "GPS problems" wizard (green/red checks like Activy).
4. Social sharing with ready-made graphics.
5. Push: city ranking, quest, end of season (retention).
6. Offline / poor coverage (MMKV outbox as an edge).

### Tier 1b — minimum for the first paid league (club/company, 6–8 weeks)

- Mobile: Club Detail + join + challenge accept; "My league" / Battle screen (You vs Them, bar, countdown); invite flow (link/code); push "club losing by 12 km, 3 days left".
- Admin: season creator (name, dates, type 1v1/league, sport, normalization, publish); opponent invitation (PENDING → ACTIVE like `ClubChallenge`); end-of-season report (PDF: ranking, fair-play flags, participation %).
- Trust: public scoring policy.

### Tier 2 — TENANT_ADMIN panel (polish)

1. Export "mayor/HR report" (PDF/CSV: km, participants, heatmap, CO₂).
2. Heatmaps as premium value for the tenant.
3. "Publish season / close season" workflow.
4. Playwright smoke as TENANT_ADMIN.
5. Moderation in 3 clicks — measure the <60s target in production.

### Tier 2b — scaling B2B sales

- SSO / SCIM (large companies), multi-company league (organizer tenant), department leaderboard in mobile, "captain" role, calendar integration (Outlook/Google).

### Tier 3 — GLOBAL_OWNER / platform

1. Action Inbox (pending + anti-cheat + infra + sim).
2. Tenant Command Center (sparklines, churn signals).
3. Impersonation + audit.
4. GO-only feature flags.
5. Prod vs sim never on one dashboard.

### Tier 3b — sports clubs (hardcore)

- CHECKPOINT / ROUTE_MATCH events (club runs with POIs), KOM segments ("segment wars"), club Matrix chat (provisioning already exists).

### What deliberately NOT to implement at the start

- All 18 disciplines like AM (better 5–6 with good anti-cheat).
- Move-to-earn / crypto (skepticism, regulatory risk).
- Own social network (export/leaderboard is enough).
- Competing with Strava as a tracker (position "hub + fair league + white-label").
- Full play-off bracket and in-app entry-fee payments (contest/gambling regulation) — only later.

---

## 12. Recommended order (90 days)

1. Local-gov sales kit (one-pager, DPIA template, sim report, anti-cheat policy).
2. CityHub + season end-to-end (mobile + tenant publish workflow).
3. GPS wizard + push retention (mobile).
4. Mayor/HR report + heatmap export (tenant admin).
5. GO Action Inbox + tenant health (if multi-tenant grows).
6. Pilots: 1 internal company (4 departments, 6 weeks) + 1 club 1v1 (two clubs, 30 days); then a multi-company league.

---

## 13. Strategic summary

Technically, 4VELO is **ahead of the market** (anti-cheat, outbox, multi-tenant, sim, the `Club`/`ClubChallenge`/`Event` INTER_TENANT/CLUB_BATTLE model, departments, normalization). Commercially it is **behind** Love to Ride / STADTRADELN / Activy in campaign readiness and narrative.

The biggest lever now:

- finishing **mobile clubs/battle/leaderboard** wired to the existing API,
- a **self-serve season creator + invite** in the admin,
- an **end-of-season report** (HR/mayor/captain),
- a public **trust story** (anti-cheat, scoring, stability, peak proof).

This makes the product easy to buy for HR and club boards — without building the backend from scratch.

---

## 14. Source and scope

This document is a consolidation of the full strategic session (competitor research, community signals, Aktywne Miasta benchmark, 4VELO code analysis, club/company sales strategy). Market material is based on public sources; product analysis is based on the SPORT repository. Companion documents: [exec one-pager](./SPORT_EXEC_ONE_PAGER_2026-06-11.en.md) and [delivery checklist 90 days](./SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.en.md).
