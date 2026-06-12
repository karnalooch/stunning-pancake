# 4VELO — one-pager dla decydenta

| | |
|--|--|
| **Status** | Active — send-ready |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Owner** | Founder / Strategy |
| **Audience** | Burmistrz, dyrektor HR, zarząd klubu, inwestor |
| **lang** | pl |
| **translation** | [English](../en/ONE_PAGER.md) |
| **canonical_path** | docs/gtm/pl/ONE_PAGER.md |
| **Pakiet GTM** | [gtm/README.md](../README.md) |

---

## Problem rynku

Aplikacje sportowo-rywalizacyjne (miejskie, korporacyjne, klubowe) cierpią na te same bolączki: **oszustwa w rankingach bez egzekucji zasad**, **niestabilny tracking GPS w tle**, **awarie przy szczytach** (Aktywne Miasta padły przy ~150k sesjach), **słabe integracje** i **sezonowość → churn**. Kupujący (samorząd, HR, zarząd klubu) nie ufa wynikom.

## Specjalizacja produktu

**Tylko trzy dyscypliny:** rower, bieganie, nordic walking — weryfikacja GPS, anti-cheat i scoring zaprojektowane pod te aktywności. Bez katalogu 18 dyscyplin i bez wellness wyłącznie na krokach.

## Pozycja 4VELO

Jedyna platforma łącząca jednocześnie: **white-label multi-tenant + rower/bieg/NW + techniczny anti-cheat (4 warstwy) + odporność mobilną (outbox) + backend przetestowany pod skalę 10k–300k + konsola operatora**.

| | 4VELO | STADTRADELN | Love to Ride | Activy | Aktywne Miasta |
|--|:-----:|:-----------:|:------------:|:------:|:--------------:|
| White-label | ✓ | ✗ | ✗ | ○ | ✗ |
| Anti-cheat tech | ✓ | ✗ | ✗ | ○ | ✗ |
| Rower + bieg + NW | ✓ | ✗ (rower) | ✗ (rower) | ✗ (kroki) | ✗ (18 dyscyplin) |
| Scale tested | ✓ | ? | ? | ? | ✗ |
| 1v1 / ligi w API | ✓ | ✗ | ○ | ✓ | ○ |

## Zaufanie i bezpieczeństwo danych

**Anti-cheat (4 warstwy):** kinematyczna bramka szybka, ML anomalii, walidacja trasy (BRouter), scoring weryfikacyjny + forensics. Publiczna polityka: **{admin-domain}/#/trust/anti-cheat** — szczegóły w [ANTI_CHEAT_SCORING_POLICY.md](./trust/ANTI_CHEAT_SCORING_POLICY.md).

**Odporność na szczyt sezonu:** burst protection, global load guard, symulacje 10k–300k użytkowników. Jednostronicowy dowód: [SCALE_PROOF_ONE_PAGER.md](./operations/SCALE_PROOF_ONE_PAGER.md). Runbook weekendu kampanii: [RSP_WEEKEND_RUNBOOK.md](./operations/RSP_WEEKEND_RUNBOOK.md).

**RODO:** szablon DPIA i lista podprocesorów per tenant — [DPIA_TEMPLATE.md](./compliance/DPIA_TEMPLATE.md) · [SUBPROCESSORS_TEMPLATE.md](./compliance/SUBPROCESSORS_TEMPLATE.md). Rejestr czynności: [RCP.md](../../compliance/RCP.md).

## Trzy ścieżki przychodu

1. **Miasta / JST** — kampanie sezonowe, heatmapy, civic pride.
2. **Firmy** — liga wewnętrzna działów lub firma vs firma; buyer: HR; raport wellbeing.
3. **Kluby** — klub vs klub i ligi sezonowe; buyer: zarząd klubu / federacja.

Jedna platforma, różny packaging — tenant = miasto / firma / organizator ligi.

## Co dostaje tenant przy starcie

Pakiet „start kampanii”: regulamin, FAQ GPS/bateria, harmonogram T-4…T+1, brief plakatu, szablon maila kickoff — [campaign-start/README.md](./campaign-start/README.md).

## Plan dowodu (piloty, 90 dni)

| Pilot | Zakres | Outcome |
|-------|--------|---------|
| **A — firma wewnętrzna** | 4 działy, 6 tygodni, 1 tenant | Zamknięty sezon + raport HR bez ręcznej interwencji developera |
| **B — klub 1v1** | 2 kluby (bieg lub rower), 30 dni | Zakończony pojedynek + case study fair scoring |

Następnie: liga wielofirmowa (organizer tenant) → case study do sprzedaży kolejnych tenantów.

## Roadmap produktu (skrót, 90 dni)

1. Sales kit JST — **w toku (Tier 0)**
2. Mobile clubs + battle/leaderboard spięte z API
3. Self-serve kreator sezonu + invite w panelu admina
4. Raport końcowy (burmistrz / HR / kapitan) + eksport heatmap
5. Publiczna polityka fair-play jako widoczny differentiator — **URL live**

## Jedno zdanie

**4VELO ma technologię, której rynek nie ma; brakuje domknięcia mobile clubs — to 90 dni pracy produktowej, nie nowy backend.**

## Kontakt / następny krok

- Umów demo panelu operatora + mobile (30 min).
- Wybierz pilot A (firma) lub B (klub) — start w ciągu 2 tygodni od podpisania DPIA.
- Timeline pełnego Tier 0–1b: ~9 tygodni do pierwszej płatnej ligi.

---

*Eksport PDF: `pandoc docs/gtm/pl/ONE_PAGER.md -o ONE_PAGER_PL.pdf` lub Drukuj → PDF z edytora markdown.*
