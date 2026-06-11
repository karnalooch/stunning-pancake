# 4VELO / SPORT — exec one-pager

| | |
|--|--|
| **Status** | Active |
| **Date** | 2026-06-11 |
| **Owner role** | Founder / Strategy |
| **Audience** | Board, investor, decision-maker |
| **lang** | en |
| **translation** | [Polski](../../reports/SPORT_EXEC_ONE_PAGER_2026-06-11.pl.md) |
| **canonical_path** | docs/en/reports/SPORT_EXEC_ONE_PAGER_2026-06-11.en.md |
| **Full report** | [SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md) |

---

## Market problem

Sports-competition apps (municipal, corporate, club) suffer the same pains: **ranking cheating with no rule enforcement**, **unstable background GPS tracking**, **crashes at peak** (Aktywne Miasta crashed at ~150k sessions), **weak integrations** and **seasonality → churn**. Buyers (local government, HR, club boards) do not trust the results.

## 4VELO position

The only platform combining all of: **white-label multi-tenant + multi-sport + technical anti-cheat (4 layers) + mobile resilience (outbox) + scale-tested backend (10k–300k) + operator console**. Competitors have at most 2–3 of these.

| | 4VELO | STADTRADELN | Love to Ride | Activy | Aktywne Miasta |
|--|:-----:|:-----------:|:------------:|:------:|:--------------:|
| White-label | ✓ | ✗ | ✗ | ○ | ✗ |
| Anti-cheat tech | ✓ | ✗ | ✗ | ○ | ✗ |
| Multi-sport | ✓ | ✗ | ✗ | ○ | ✓ |
| Scale tested | ✓ | ? | ? | ? | ✗ |
| 1v1 / leagues in API | ✓ | ✗ | ○ | ✓ | ○ |

## State: readiness vs gap

- **Backend ready:** `Tenant` (white-label), `Club`/`ClubChallenge` (1v1), `Event` (INTER_TENANT, CLUB_BATTLE), `Department` (company leagues), score normalization, anti-cheat, scale simulations.
- **Gap:** mobile for clubs/leagues (placeholder), self-serve season creator, end-of-season report for the decision-maker, public "trust story". Commercially we are behind Love to Ride/STADTRADELN on GTM readiness, technically ahead of the market.

## Three revenue paths

1. **Cities / local government** — seasonal campaigns (AM/STADTRADELN model), heatmaps, civic pride.
2. **Companies** — internal department league or company vs company; buyer: HR; wellbeing report.
3. **Clubs** — club vs club and seasonal leagues; buyer: club board/federation.

One platform, different packaging — tenant = city / company / league organizer.

## 5 priorities (next 90 days)

1. **Local-gov sales kit** (one-pager, DPIA, simulation report, anti-cheat policy).
2. **Mobile clubs + battle/leaderboard** wired to the existing API.
3. **Self-serve season creator + invite** in the admin panel.
4. **End-of-season report** (mayor / HR / captain) + heatmap export.
5. **Public fair-play/scoring policy** as a visible differentiator.

## Proof plan (pilots)

- **Pilot A — internal company:** 4 departments, 6 weeks, one tenant (fastest proof).
- **Pilot B — club 1v1:** two running clubs, 30 days.
- Then: multi-company league (organizer tenant) → case study to sell further tenants.

## One sentence

**4VELO has technology the market lacks; what is missing is the sales package and finishing mobile clubs — that is 90 days of work, not a new backend.**
