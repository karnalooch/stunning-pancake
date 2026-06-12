# 4VELO — pakiet sprzedażowy GTM / trust (Tier 0)


| | |
|--|--|
| **Status** | Active |
| **Data** | 2026-06-12 |
| **Owner role** | Product / Delivery Lead |
| **Audience** | Sales, Founder, Legal, Platform Operator |
| **lang** | pl |
| **translation** | [English](./en/README.md) |
| **canonical_path** | docs/gtm/README.md |
| **Checklista** | [SPORT_DELIVERY_CHECKLIST_90D](../reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.pl.md) |

---

Jedno wejście do materiałów **Tier 0 — iteracja 1 (Sales kit)**. Dokumenty są gotowe do wysłania decydentowi (JST, HR, zarząd klubu) lub do onboardingu tenanta.

## Mapowanie na checklistę Tier 0

| Pozycja checklisty | Dokument | PL | EN |
|------------------|----------|----|----|
| One-pager / pitch | Send-ready one-pager + deck | [pl/ONE_PAGER.md](./pl/ONE_PAGER.md) · [PITCH_DECK.pptx](./pl/PITCH_DECK.pptx) | [en/ONE_PAGER.md](./en/ONE_PAGER.md) · [PITCH_DECK.pptx](./en/PITCH_DECK.pptx) |
| Pakiet „start kampanii” | Campaign start kit | [pl/campaign-start/](./pl/campaign-start/README.md) | [en/campaign-start/](./en/campaign-start/README.md) |
| Publiczna Anti-Cheat / Scoring Policy | Trust policy | [pl/trust/ANTI_CHEAT_SCORING_POLICY.md](./pl/trust/ANTI_CHEAT_SCORING_POLICY.md) | [en/trust/ANTI_CHEAT_SCORING_POLICY.md](./en/trust/ANTI_CHEAT_SCORING_POLICY.md) |
| Runbook peak + raport symulacji | Operations proof | [pl/operations/RSP_WEEKEND_RUNBOOK.md](./pl/operations/RSP_WEEKEND_RUNBOOK.md) · [SCALE_PROOF_ONE_PAGER.md](./pl/operations/SCALE_PROOF_ONE_PAGER.md) | [en/operations/](./en/operations/) |
| DPIA + podprocesorzy | Compliance templates | [pl/compliance/](./pl/compliance/DPIA_TEMPLATE.md) | [en/compliance/](./en/compliance/DPIA_TEMPLATE.md) |

**Publiczny URL polityki:** `{admin-domain}/#/trust/anti-cheat` (panel admin, trasa publiczna).

**Tier 0 status:** zamknięty (iteracja 2, 2026-06-12) — [checklista](../reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.pl.md).

Regeneracja decku: `python scripts/gtm/generate_pitch_deck.py`

## Eksport do PDF

```bash
# Z katalogu repo (wymaga pandoc)
pandoc docs/gtm/pl/ONE_PAGER.md -o ONE_PAGER_PL.pdf
pandoc docs/gtm/en/ONE_PAGER.md -o ONE_PAGER_EN.pdf
```

Alternatywa: otwórz plik `.md` w edytorze → Drukuj → Zapisz jako PDF.

## Powiązane

| Dokument | Opis |
|----------|------|
| [SPORT_EXEC_ONE_PAGER](../reports/SPORT_EXEC_ONE_PAGER_2026-06-11.pl.md) | Źródło strategiczne one-pagera |
| [COMPLIANCE_INDEX](../compliance/COMPLIANCE_INDEX.md) | Macierz zgodności |
| [RCP](../compliance/RCP.md) | Rejestr czynności przetwarzania |
