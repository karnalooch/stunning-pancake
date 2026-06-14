# Mobile Sprint 1 — Day 1 kickoff checklist (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, release |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) |
| **canonical_path** | docs/pl/operations/MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md |
| **Powiązane** | [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) |

---

## Cel

Jednostronicowa checklista operacyjna na start D1: spotkanie kickoff, przypisanie `P0`, kontrola ryzyk i zamknięcie dnia.

---

## 1) Kickoff (09:00, 35 min)

## Agenda

- 5 min: potwierdzenie scope `IN/OUT` (`S1-PT-01`).
- 10 min: potwierdzenie AC dla ride core (`S1-PT-02`).
- 10 min: przypisanie owner + ETA dla wszystkich `P0`.
- 5 min: lista blockerów i owner unblock.
- 5 min: potwierdzenie checkpointów 13:00 i 17:00.

## Wynik obowiązkowy po kickoff

- [ ] Każdy ticket `P0` ma ownera i ETA.
- [ ] Brak niejasności co do kryteriów `Done` dla `S1-MOB-02`, `S1-MOB-04`, `S1-BE-01`, `S1-QA-01`.
- [ ] Jest jedna osoba odpowiedzialna za decyzję `GO/NO-GO` na koniec dnia (PM lub Mobile Lead).

---

## 2) Przydział Day 1 (P0 lane)

| Rola | Tickety Day 1 | Target status do 17:00 |
|------|---------------|-------------------------|
| Product trio | `S1-PT-01`, `S1-PT-02` | Done |
| Mobile | `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-03`, start `S1-MOB-04` | 3x Done + 1x In Progress |
| Backend | `S1-BE-01`, start `S1-BE-02` | 1x Done + 1x In Progress |
| QA | przygotowanie pod `S1-QA-01`, `S1-QA-02` | Ready |
| Release | start `S1-REL-01` | In Progress |
| Security | start `S1-SEC-01` | In Progress |

---

## 3) Checkpoint 13:00 (15 min)

- [ ] Mobile zgłasza status kontraktu `RideSummary`/deep-link (`S1-MOB-02`).
- [ ] Backend potwierdza status auth refresh (`S1-BE-01`).
- [ ] QA potwierdza gotowość smoke scope + device matrix.
- [ ] Release potwierdza brak blokera env policy.
- [ ] Jeśli którykolwiek `P0` jest `Blocked`, musi mieć owner unblock i ETA.

---

## 4) End-of-day gate 17:00

## Minimalne warunki zamknięcia D1

- [ ] `S1-MOB-01` i `S1-MOB-02` nie są otwarte jako `Blocked`.
- [ ] `S1-PT-01` i `S1-PT-02` są `Done`.
- [ ] `P0 blocker list` istnieje i ma mitigation + ETA.
- [ ] Plan D2 jest potwierdzony (kto zamyka które `P0/P1`).

## Decyzja dnia

- `GREEN`: wszystkie warunki spełnione -> D2 zgodnie z planem.
- `YELLOW`: 1-2 warunki niespełnione -> D2 tylko `P0`, cięcie `P1`.
- `RED`: krytyczny blocker bez ownera -> eskalacja do PM + Tech Lead natychmiast.

---

## 5) Protokół blockerów (SLA)

- 0-30 min: owner ticketu próbuje unblock lokalny.
- 30-60 min: eskalacja do ownera zależności (backend/release/security).
- >60 min: decyzja PM + Tech Lead: re-scope lub mitigation.

Każdy blocker wpisujemy w formacie:

`Ticket:`  
`Blocker:`  
`Owner unblock:`  
`ETA unblock:`  
`Plan B:`

---

## 6) Artefakty, które muszą istnieć po D1

- Zaktualizowany board status (co najmniej wszystkie `P0`).
- Uzupełniony daily status template z `MOBILE_SPRINT1_REVIEW_PACKET`.
- Jedna notatka decyzji: scope, ryzyka, plan D2.
