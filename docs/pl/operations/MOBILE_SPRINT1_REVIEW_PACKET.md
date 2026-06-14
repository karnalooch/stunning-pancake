# Mobile Sprint 1 Review Packet (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, mobile, backend, QA, DevOps, data, design, security |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_SPRINT1_REVIEW_PACKET.md) |
| **canonical_path** | docs/pl/operations/MOBILE_SPRINT1_REVIEW_PACKET.md |
| **Powiązane** | [MOBILE_SPRINT1_BOARD_SEED.md](./MOBILE_SPRINT1_BOARD_SEED.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md](./MOBILE_SPRINT1_DAY1_KICKOFF_NOTES_TEMPLATE.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md](../design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |

---

## Cel

Gotowy pakiet do użycia w Sprint 1:

- checklisty per rola,
- format tasków i findings,
- template statusu dziennego,
- finalny sign-off przed zamknięciem sprintu.

Treść można wkleić bez zmian do Notion/Jira/Linear.

---

## Pre-signoff snapshot (2026-06-14)

Status na podstawie aktualnego stanu repo i ostatniej walidacji technicznej:

| Obszar | Status | Evidence / Notatka |
|--------|--------|---------------------|
| Mobile engineering gate | GO | `pnpm exec tsc --noEmit` zielone; pełny Jest `19/19` suite i `97/97` testów; `--detectOpenHandles --runInBand` bez raportu open handles |
| Lint gate | GO (z backlogiem) | Brak błędów lint; istnieją ostrzeżenia historyczne (tech-debt), brak nowych errorów blokujących |
| QA manual device matrix | NO-GO (pending) | Do wykonania: Android/iOS manual smoke + deep links + offline/reconnect |
| DevOps/Release gate | NO-GO (pending) | Do potwierdzenia: preview build, rollback path, telemetry/crash na preview |
| Security/Privacy gate | NO-GO (pending) | Do formalnego odhaczenia: token/log hygiene + privacy zones fallback |
| Cross-functional final sign-off | NO-GO (pending) | Wymaga statusu GO od wszystkich ownerów w sekcji 7 |

### Szybka ścieżka domknięcia (operacyjna)

- Krok 1 (QA): wykonać smoke i manual matrix, podpiąć evidence.
- Krok 2 (Release/DevOps): potwierdzić preview + rollback + telemetry.
- Krok 3 (Security/Privacy): audyt checklisty i decyzja GO/NO-GO.
- Krok 4 (Product trio): zatwierdzenie AC Ride/Explore/Profile.
- Krok 5: uzupełnić tabelę sign-off i wydać finalną rekomendację release.

---

## Snapshot wykonania (2026-06-14)

- Mobile compile gate: `pnpm exec tsc --noEmit` ✅.
- Evidence testów (targeted regression): 10 suite / 59 testów ✅.
- Kodowo domknięte: kontrakt nawigacji/deep links, hardening HUD, i18n onboarding/detail, edge states, release env policy (`API`/`telemetry`/`social auth`), layout pattern (`Ride/Explore/Profile`).
- Otwarte operacyjnie: manual QA device matrix (Android/iOS) i finalny cross-functional sign-off.

---

## 1) Sprint 1 Scope (recommended)

- Architektura i kontrakty:
  - nawigacja (`types`, `routeContract`, `linking`),
  - granice modułów (`features/*`),
  - kontrakt error/offline/loading.
- Ride core:
  - start/pause/resume/stop,
  - summary handoff,
  - GPS recovery path.
- Quality baseline:
  - smoke E2E krytycznych flow,
  - minimalne testy unit/integration dla kontraktów.

---

## 2) Board structure (copy/paste)

## Kolumny

`Backlog` → `Ready` → `In Progress` → `Review` → `QA` → `Done`

## Etykiety

- Priorytet: `P0`, `P1`, `P2`
- Typ: `feature`, `bug`, `tech-debt`, `docs`, `ops`
- Obszar: `mobile`, `backend`, `qa`, `design`, `security`, `release`

## Definition of Done (global)

- [ ] Kod + testy + docs zaktualizowane
- [ ] PL/EN parity dla nowych stringów/dokumentów
- [ ] Edge states (offline/loading/error/empty) pokryte
- [ ] Brak otwartego P0 dla taska

---

## 3) Rola-po-roli checklisty Sprint 1

## Product trio (PM + UX/UI + Tech Lead)

- [ ] Potwierdzony scope sprintu (co jest IN/OUT).
- [ ] Potwierdzona kolejność P0/P1.
- [ ] Potwierdzone kryteria akceptacji ekranów Ride/Explore/Profile.
- [ ] Zaktualizowano:
  - `docs/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/pl/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md`.

## Mobile team

- [ ] Kontrakt tras i deep-linków jest spójny.
- [ ] Ride lifecycle działa end-to-end.
- [ ] Settings sekcje zapisują preferencje bez regresji.
- [ ] i18n parity PL/EN zachowana.
- [ ] Zaktualizowano:
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`.

## Backend/API team

- [ ] Auth refresh i session restore stabilne.
- [ ] Retry/backoff polityka zgodna z runbookiem.
- [ ] GPS sync_path/finalize edge-case przejrzane.
- [ ] Zaktualizowano:
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/API.md` lub `docs/pl/API.md` (jeśli kontrakt się zmienił)
  - traceability matrix (FR/NFR status).

## QA

- [ ] Smoke: auth, ride lifecycle, GPS recovery, immersive.
- [ ] Manual matrix: deep links + offline/reconnect + settings.
- [ ] Lista regresji P0/P1 wpisana z ownerami.
- [ ] Zaktualizowano verification gate.

## DevOps/Release

- [ ] Build profiles i env gotowe dla preview.
- [ ] Release/rollback checklist aktualna.
- [ ] Telemetry i crash reporting zweryfikowane.
- [ ] Zaktualizowano `MOBILE.md` (PL/EN) jeśli zmieniono proces.

## Data/Analytics

- [ ] Eventy krytyczne Ride/Auth/Share istnieją i są spójne.
- [ ] Metryki perf budget są raportowane.
- [ ] Uzupełniono traceability NFR observability.

## Design production

- [ ] Spójność ikon/chrome/card/HUD potwierdzona.
- [ ] Brak nowych placeholderów/emoji.
- [ ] Integer scaling i ostrość assetów sprawdzona.
- [ ] Zaktualizowano audyt Grand Prix (EN/PL), jeśli wykryto drift.

## Security/Privacy/Compliance

- [ ] Token handling i logowanie błędów bez wycieku danych.
- [ ] Privacy zones flow ma poprawne fallbacki.
- [ ] Brak wrażliwych danych w config/runtime.
- [ ] Zaktualizowano odpowiednie sekcje governance/compliance.

---

## 4) Template taska (Jira/Linear/Notion)

## Title
`[Role][Priority] Krótki cel`

## Context
- Dlaczego to robimy:
- Zakres:

## Acceptance Criteria
- [ ] AC-1
- [ ] AC-2
- [ ] AC-3

## Evidence
- Testy:
- Screeny/nagrania:
- Docs updated:

## Risk
- Co może pójść źle:
- Mitigation:

## Owner / ETA
- Owner:
- ETA:

---

## 5) Template findings (cross-functional review)

`Issue:`  
`Impact:`  
`Recommendation:`  
`Priority:` P0/P1/P2  
`Owner:`  
`Linked task:`  
`Docs to update:`

---

## 6) Daily status template (15-min standup)

## Yesterday
- Done:

## Today
- Plan:

## Blockers
- Blocker:
- Owner needed:

## Risk update
- New P0/P1:

---

## 7) Sprint 1 final sign-off sheet

| Rola | Status (GO/NO-GO) | Otwarte P0 | Otwarte P1 | Owner podpis |
|------|-------------------|------------|------------|--------------|
| Product trio |  |  |  |  |
| Mobile |  |  |  |  |
| Backend/API |  |  |  |  |
| QA |  |  |  |  |
| DevOps/Release |  |  |  |  |
| Data/Analytics |  |  |  |  |
| Design production |  |  |  |  |
| Security/Privacy |  |  |  |  |

### Draft prefill + symulowana decyzja ownerów (2026-06-14)

| Rola | Status (GO/NO-GO) | Otwarte P0 | Otwarte P1 | Owner podpis |
|------|-------------------|------------|------------|--------------|
| Product trio | NO-GO (pending owner sign-off) | 1 (brak formalnego potwierdzenia AC/IN-OUT) | 0 |  |
| Mobile | GO | 0 | backlog tech-debt |  |
| Backend/API | NO-GO (pending owner sign-off) | 1 (brak formalnego potwierdzenia kontraktu) | 0 |  |
| QA | NO-GO (manual matrix pending) | 1 (Android/iOS smoke + deep link + offline) | 0 |  |
| DevOps/Release | NO-GO (release gate pending) | 1 (preview + rollback + telemetry) | 0 |  |
| Data/Analytics | NO-GO (observability evidence pending) | 1 (krytyczne eventy/perf bez formalnego evidence) | 0 |  |
| Design production | NO-GO (visual sign-off pending) | 1 (final drift-free check na aktualnym buildzie) | 0 |  |
| Security/Privacy | NO-GO (checklist pending) | 1 (token/log/privacy checklist niezamknieta) | 0 |  |

Uwaga: to jest symulacja decyzji na podstawie dowodow repo i gate'ow technicznych. Finalny podpis release wymaga wpisu realnych ownerow.

### 5 krokow do pelnego GO (operacyjny runbook)

1. **QA gate:** domknac manual matrix (Android+iOS) dla smoke/deep-link/offline i zalaczyc evidence.
2. **Release gate:** potwierdzic preview build, rollback path oraz telemetry/crash collection na preview.
3. **Security gate:** zamknac checklist token/log/privacy i wpisac decyzje ownera Security/Privacy.
4. **Product gate:** zatwierdzic AC i zakres IN/OUT dla Ride/Explore/Profile w tabeli sign-off.
5. **Final gate:** uzupelnic podpisy wszystkich rol i opublikowac finalna rekomendacje `GO`/`NO-GO`.

## Release recommendation

- `GO` tylko jeśli:
  - brak otwartego P0,
  - każdy owner ma status `GO`,
  - verification gate jest zielony.

- `NO-GO` jeśli:
  - istnieje choć jeden nierozwiązany P0 bez mitigation.
