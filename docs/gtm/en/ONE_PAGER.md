# 4VELO — decision-maker one-pager

| | |
|--|--|
| **Status** | Active — send-ready |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Owner** | Founder / Strategy |
| **Audience** | Mayor, HR director, club board, investor |
| **lang** | en |
| **translation** | [Polski](../pl/ONE_PAGER.md) |
| **canonical_path** | docs/gtm/en/ONE_PAGER.md |
| **GTM kit** | [gtm/README.md](../README.md) |

---

## Market problem

Sports-competition apps (municipal, corporate, club) suffer the same pains: **ranking cheating with no rule enforcement**, **unstable background GPS tracking**, **crashes at peak** (Aktywne Miasta crashed at ~150k sessions), **weak integrations** and **seasonality → churn**. Buyers (local government, HR, club boards) do not trust the results.

## Product scope

**Only three disciplines:** cycling, running, nordic walking — GPS verification, anti-cheat and scoring built for these activities. No 18-discipline catalog and no step-only wellness.

## 4VELO position

The only platform combining all of: **white-label multi-tenant + cycling/running/NW + technical anti-cheat (4 layers) + mobile resilience (outbox) + backend scale-tested 10k–300k + operator console**.

| | 4VELO | STADTRADELN | Love to Ride | Activy | Aktywne Miasta |
|--|:-----:|:-----------:|:------------:|:------:|:--------------:|
| White-label | ✓ | ✗ | ✗ | ○ | ✗ |
| Anti-cheat tech | ✓ | ✗ | ✗ | ○ | ✗ |
| Cycling + run + NW | ✓ | ✗ (cycling) | ✗ (cycling) | ✗ (steps) | ✗ (18 disciplines) |
| Scale tested | ✓ | ? | ? | ? | ✗ |
| 1v1 / leagues in API | ✓ | ✗ | ○ | ✓ | ○ |

## Trust and data protection

**Anti-cheat (4 layers):** fast kinematic gate, ML anomalies, route validation (BRouter), verification score + forensics. Public policy: **{admin-domain}/#/trust/anti-cheat** — details in [ANTI_CHEAT_SCORING_POLICY.md](./trust/ANTI_CHEAT_SCORING_POLICY.md).

**Peak-season resilience:** burst protection, global load guard, 10k–300k user simulations. One-page proof: [SCALE_PROOF_ONE_PAGER.md](./operations/SCALE_PROOF_ONE_PAGER.md). Campaign weekend runbook: [RSP_WEEKEND_RUNBOOK.md](./operations/RSP_WEEKEND_RUNBOOK.md).

**GDPR:** DPIA template and per-tenant subprocessor list — [DPIA_TEMPLATE.md](./compliance/DPIA_TEMPLATE.md) · [SUBPROCESSORS_TEMPLATE.md](./compliance/SUBPROCESSORS_TEMPLATE.md). Processing register: [RCP.md](../../compliance/RCP.md).

## Three revenue paths

1. **Cities / local government** — seasonal campaigns, heatmaps, civic pride.
2. **Companies** — internal department league or company vs company; buyer: HR; wellbeing report.
3. **Clubs** — club vs club and seasonal leagues; buyer: club board / federation.

One platform, different packaging — tenant = city / company / league organizer.

## What the tenant gets at launch

Campaign start kit: rules, GPS/battery FAQ, T-4…T+1 schedule, poster brief, kickoff email template — [campaign-start/README.md](./campaign-start/README.md).

## Proof plan (pilots, 90 days)

| Pilot | Scope | Outcome |
|-------|-------|---------|
| **A — internal company** | 4 departments, 6 weeks, 1 tenant | Closed season + HR report with zero manual developer intervention |
| **B — club 1v1** | 2 clubs (running or cycling), 30 days | Finished head-to-head + fair scoring case study |

Then: multi-company league (organizer tenant) → case study to sell further tenants.

## Product roadmap (summary, 90 days)

1. Local-gov sales kit — **in progress (Tier 0)**
2. Mobile clubs + battle/leaderboard wired to API
3. Self-serve season creator + invite in admin panel
4. End-of-season report (mayor / HR / captain) + heatmap export
5. Public fair-play policy as visible differentiator — **URL live**

## One sentence

**4VELO has technology the market lacks; what remains is finishing mobile clubs — that is 90 days of product work, not a new backend.**

## Contact / next step

- Book a 30-minute operator panel + mobile demo.
- Choose pilot A (company) or B (club) — start within 2 weeks of DPIA signature.
- Full Tier 0–1b timeline: ~9 weeks to first paid league.

---

*PDF export: `pandoc docs/gtm/en/ONE_PAGER.md -o ONE_PAGER_EN.pdf` or Print → PDF from your markdown editor.*
