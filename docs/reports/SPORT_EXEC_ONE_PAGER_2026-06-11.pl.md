# 4VELO / SPORT — exec one-pager

| | |
|--|--|
| **Status** | Active |
| **Data** | 2026-06-11 |
| **Owner role** | Founder / Strategy |
| **Audience** | Zarząd, inwestor, decydent |
| **lang** | pl |
| **translation** | [English](../en/reports/SPORT_EXEC_ONE_PAGER_2026-06-11.en.md) |
| **canonical_path** | docs/reports/SPORT_EXEC_ONE_PAGER_2026-06-11.pl.md |
| **Pełny raport** | [SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md) |

---

## Problem rynku

Aplikacje sportowo-rywalizacyjne (miejskie, korporacyjne, klubowe) cierpią na te same bolączki: **oszustwa w rankingach bez egzekucji zasad**, **niestabilny tracking GPS w tle**, **awarie przy szczytach** (Aktywne Miasta padły przy ~150k sesjach), **słabe integracje** i **sezonowość → churn**. Kupujący (samorząd, HR, zarząd klubu) nie ufa wynikom.

## Pozycja 4VELO

Jedyna platforma łącząca jednocześnie: **white-label multi-tenant + multi-sport + techniczny anti-cheat (4 warstwy) + odporność mobilną (outbox) + scale-tested backend (10k–300k) + konsola operatora**. Konkurenci mają najwyżej 2–3 z tych elementów.

| | 4VELO | STADTRADELN | Love to Ride | Activy | Aktywne Miasta |
|--|:-----:|:-----------:|:------------:|:------:|:--------------:|
| White-label | ✓ | ✗ | ✗ | ○ | ✗ |
| Anti-cheat tech | ✓ | ✗ | ✗ | ○ | ✗ |
| Multi-sport | ✓ | ✗ | ✗ | ○ | ✓ |
| Scale tested | ✓ | ? | ? | ? | ✗ |
| 1v1 / ligi w API | ✓ | ✗ | ○ | ✓ | ○ |

## Stan: gotowość vs luka

- **Backend gotowy:** `Tenant` (white-label), `Club`/`ClubChallenge` (1v1), `Event` (INTER_TENANT, CLUB_BATTLE), `Department` (ligi firmowe), normalizacja wyniku, anti-cheat, symulacje skali.
- **Luka:** mobile dla klubów/lig (placeholder), self-serve kreator sezonu, raport końcowy dla decydenta, publiczne "trust story". Komercyjnie jesteśmy za Love to Ride/STADTRADELN w gotowości GTM, technicznie przed rynkiem.

## Trzy ścieżki przychodu

1. **Miasta / JST** — kampanie sezonowe (model AM/STADTRADELN), heatmapy, civic pride.
2. **Firmy** — liga wewnętrzna działów lub firma vs firma; buyer: HR; raport wellbeing.
3. **Kluby** — klub vs klub i ligi sezonowe; buyer: zarząd klubu/federacja.

Jedna platforma, różny packaging — tenant = miasto / firma / organizator ligi.

## 5 priorytetów (najbliższe 90 dni)

1. **Sales kit JST** (one-pager, DPIA, raport z symulacji, anti-cheat policy).
2. **Mobile clubs + battle/leaderboard** spięte z istniejącym API.
3. **Self-serve kreator sezonu + invite** w panelu admina.
4. **Raport końcowy** (burmistrz / HR / kapitan) + eksport heatmap.
5. **Publiczna polityka fair-play/scoring** jako widoczny differentiator.

## Plan dowodu (piloty)

- **Pilot A — firma wewnętrzna:** 4 działy, 6 tygodni, jeden tenant (najszybszy dowód).
- **Pilot B — klub 1v1:** dwa kluby biegowe, 30 dni.
- Następnie: liga wielofirmowa (organizer tenant) → case study do sprzedaży kolejnych tenantów.

## Jedno zdanie

**4VELO ma technologię, której rynek nie ma; brakuje pakietu sprzedażowego i domknięcia mobile clubs — to 90 dni pracy, nie nowy backend.**
