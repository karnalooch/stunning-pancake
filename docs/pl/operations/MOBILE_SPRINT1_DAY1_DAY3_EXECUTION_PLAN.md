# Mobile Sprint 1 — plan wykonawczy D1-D3 (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, release |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) |
| **canonical_path** | docs/pl/operations/MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md |
| **Powiązane** | [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Cel

Plan operacyjny na pierwsze 3 dni Sprint 1: kto robi co, w jakiej kolejności, jakie są zależności i jaki artefakt ma powstać na koniec każdego dnia.

---

## Założenia wykonawcze

- Sprint startuje od ticketów `P0` (bez równoległego uruchamiania `P2`).
- WIP limit:
  - Mobile: maks. 3 tickety równolegle,
  - Backend: maks. 2,
  - QA: 1 smoke lane + 1 regresja lane.
- Każdy ticket `P0` musi mieć ownera i ETA jeszcze w D1.
- Codziennie 15-min standup wg template z `MOBILE_SPRINT1_REVIEW_PACKET`.

---

## Dzień 1 (stabilizacja krytyczna)

## Priorytet dnia

Domknąć krytyczne ryzyka release-blocking: kontrakty, lifecycle ride, auth/offline, gotowość smoke QA.

## Tickety obowiązkowe (must-finish / must-start)

| Obszar | Tickety | Owner |
|--------|---------|-------|
| Product trio | `S1-PT-01`, `S1-PT-02` | PM, Tech Lead |
| Mobile | `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-03`, start `S1-MOB-04` | Mobile Dev |
| Backend | `S1-BE-01`, start `S1-BE-02` | Backend Dev |
| QA | Przygotowanie smoke scope pod `S1-QA-01` i matrix pod `S1-QA-02` | QA Lead, QA Engineer |
| Release | Start `S1-REL-01` | Release Eng |
| Security | Start `S1-SEC-01` | Security Eng |

## Koniec dnia D1 — expected output

- Brak otwartego lint blocker dla mobile (`S1-MOB-01` done).
- Kontrakt `RideSummary` + deep link potwierdzony (`S1-MOB-02` done albo blocked z ownerem).
- Scope sprintu i AC ride core zatwierdzone (`S1-PT-01`, `S1-PT-02` done).
- Spis blockerów `P0` z mitigation i ETA.

---

## Dzień 2 (integracja i smoke)

## Priorytet dnia

Przejść przez flow end-to-end (auth -> ride lifecycle -> recovery -> summary) i zamknąć release/env ryzyka.

## Tickety obowiązkowe (must-finish / must-start)

| Obszar | Tickety | Owner |
|--------|---------|-------|
| Mobile | domknięcie `S1-MOB-04`, start `S1-MOB-05`, `S1-MOB-08` | Mobile Dev |
| Backend | domknięcie `S1-BE-02`, `S1-BE-03` | Backend Dev |
| QA | `S1-QA-01`, `S1-QA-02`, start `S1-QA-03` | QA Lead, QA Engineer |
| Release | `S1-REL-01`, `S1-REL-02`, start `S1-REL-03` | Release Eng, DevOps |
| Design | `S1-DES-01`, start `S1-DES-02` | UI Designer |
| Security | domknięcie `S1-SEC-01`, start `S1-SEC-02` | Security Eng |

## Koniec dnia D2 — expected output

- Smoke auth + ride lifecycle + gps recovery wykonany co najmniej na jednym Android i jednym iOS.
- Brak krytycznego rozjazdu backend-mobile dla `401` i `sync_path/finalize`.
- Release path (`preview` + rollback) zweryfikowany.
- Lista `P1` gotowa do docięcia w D3, bez nowych otwartych `P0`.

---

## Dzień 3 (twarde domknięcie sprint-ready)

## Priorytet dnia

Domknąć gate jakości i przygotować decyzję GO/NO-GO na podstawie evidence.

## Tickety obowiązkowe (must-finish)

| Obszar | Tickety | Owner |
|--------|---------|-------|
| Mobile | `S1-MOB-05`, `S1-MOB-06`, `S1-MOB-07` (lub udokumentowany split na Sprint 2) | Mobile Dev |
| QA | `S1-QA-03`, `S1-QA-04`, `S1-QA-05` | QA Engineer |
| Release/Data | `S1-REL-03`, `S1-REL-04`, `S1-DATA-01`, `S1-DATA-02` | DevOps, Release Eng, Data Analyst |
| Design/Security | `S1-DES-02`, `S1-SEC-02`, `S1-SEC-03` | UI Designer, Security Eng |
| Product trio | `S1-PT-03`, `S1-PT-04` | PM, UX Lead |

## Koniec dnia D3 — expected output

- Uzupełniony sign-off sheet z `MOBILE_SPRINT1_REVIEW_PACKET`.
- `MOBILE_FULL_VISION_VERIFICATION` ma status zielony albo jawnie opisane odchylenia.
- Zero otwartych `P0` bez mitigation approved.
- Decyzja release recommendation: `GO` lub `NO-GO` z uzasadnieniem.

---

## Zależności krytyczne (cross-team)

| Zależność | Blokowane tickety | Owner unblock |
|-----------|-------------------|---------------|
| Backend kontrakt `401` / refresh | `S1-MOB-04`, `S1-QA-01` | Backend Dev |
| `sync_path/finalize` edge case | `S1-QA-01`, `S1-REL-02` | Backend Dev |
| Preview env policy | `S1-QA-04`, `S1-REL-03` | Release Eng |
| Smoke matrix device availability | `S1-QA-01`, `S1-QA-02` | QA Lead |
| Token/logging hygiene findings | release recommendation | Security Eng |

---

## Dzienny rytm operacyjny

- 09:00 standup: status `P0`, blokery, owner unblock.
- 13:00 checkpoint: tylko zmiany statusu `P0/P1`, bez dyskusji architektonicznych.
- 17:00 wrap-up: evidence links, update risk list, decyzja co wchodzi na kolejny dzień.

---

## Kryterium sukcesu po D3

- Minimum 80% ticketów `P0/P1` ze sprint seed jest `Done`.
- 100% ticketów `P0` ma status `Done` albo formalne mitigation approved.
- Wszystkie zmiany user-facing mają potwierdzoną synchronizację dokumentacji PL/EN.
