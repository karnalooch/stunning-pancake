# Mobile Sprint 1 Board Seed (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product Manager / Mobile Lead |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, engineering, QA, release |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_SPRINT1_BOARD_SEED.md) |
| **canonical_path** | docs/pl/operations/MOBILE_SPRINT1_BOARD_SEED.md |
| **Powiązane** | [MOBILE_SPRINT1_REVIEW_PACKET.md](./MOBILE_SPRINT1_REVIEW_PACKET.md) · [MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md](./MOBILE_SPRINT1_DAY1_KICKOFF_CHECKLIST.md) · [MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md](./MOBILE_SPRINT1_DAY1_DAY3_EXECUTION_PLAN.md) · [MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md](./MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Jak używać

- Każdy wiersz = gotowy ticket.
- Status startowy: `Backlog`.
- Priorytety: `P0` blokuje release, `P1` wysokie, `P2` jakość.
- Jeśli ticket zmienia zachowanie user-facing, aktualizacja docs jest częścią AC.

## Import CSV

- CSV (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv)
- CSV (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv](../../en/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT.csv)
- Jira (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv)
- Jira (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv](../../en/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT_JIRA.csv)
- Linear (PL): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv](./MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv)
- Linear (EN): [MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv](../../en/operations/MOBILE_SPRINT1_BOARD_SEED_IMPORT_LINEAR.csv)

---

## Snapshot implementacji (2026-06-14)

- Mobile (kod): domknięte `S1-MOB-01`, `S1-MOB-02`, `S1-MOB-04`, `S1-MOB-05`, `S1-MOB-06`, `S1-MOB-07`, `S1-MOB-08`, `S1-MOB-09`, `S1-MOB-10`.
- `S1-MOB-03`: hardening HUD status bar domknięty po stronie kodu + testy; wymagany manual QA na Android/iOS wg AC.
- `S1-REL-01`: domknięto politykę env po stronie klienta (`API`, `telemetry`, `social auth`) — fallback tylko w `__DEV__`.
- Evidence: lint i testy punktowe zielone (route contract, RideActionBar hold-to-stop, RideStatusBar, Onboarding, socialAuth env policy).

---

## Product trio (PM + UX/UI + Tech Lead)

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-PT-01 | P0 | Zatwierdzić scope Sprint 1 (IN/OUT) | PM | Zakres opublikowany; lista wykluczeń zaakceptowana |
| S1-PT-02 | P0 | Potwierdzić kryteria akceptacji Ride core | Tech Lead | AC dla RideDashboard/HUD/Summary wpisane do boardu |
| S1-PT-03 | P1 | Uzgodnić kolejność P0/P1 dla domen | PM | Kolejność zatwierdzona przez mobile+backend+QA |
| S1-PT-04 | P1 | Zaktualizować implementation spec po kickoff | UX Lead | `4VELO_MOBILE_FULL_VISION_IMPLEMENTATION` zaktualizowany |

## Mobile team

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-MOB-01 | P0 | Naprawić lint blocker importu `StreakBadge` | Mobile Dev | `expo lint` bez errora import/no-unresolved |
| S1-MOB-02 | P0 | Ujednolicić kontrakt `RideSummary` i deep-link path | Mobile Dev | `types` + `routeContract` + `linking` spójne |
| S1-MOB-03 | P0 | Domknąć status bar HUD (GPS/battery/clock) na device | Mobile Dev | Manual QA na Android/iOS; brak null-crash |
| S1-MOB-04 | P0 | Ride stop confirm guard (hold) z testem regresji | Mobile Dev | Potwierdzenie stop działa; test/manual pass |
| S1-MOB-05 | P1 | Uporządkować hook deps warnings w krytycznych plikach | Mobile Dev | Brak nowych warnings w dotkniętych plikach |
| S1-MOB-06 | P1 | Refaktor `ActivityDetail` z i18n i bez emoji placeholderów | Mobile Dev | Labels przez i18n; brak placeholder text/emoji |
| S1-MOB-07 | P1 | Uporządkować onboarding typy i copy i18n | Mobile Dev | Mniej `any`; copy PL/EN przez i18n |
| S1-MOB-08 | P1 | Dodać edge states (offline/error/empty) w detail/trends | Mobile Dev | Widoczne i spójne fallbacki |
| S1-MOB-09 | P2 | Konsolidacja legacy wrapperów komponentów UI | Mobile Dev | Legacy deleguje do `components/ui` |
| S1-MOB-10 | P2 | Ustandaryzować spacing/layout templates na 3 głównych ekranach | Mobile Dev | Ride/Explore/Profile zgodne z patternem |

## Backend/API team

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-BE-01 | P0 | Zweryfikować auth refresh contract i błędy 401 | Backend Dev | Kontrakt udokumentowany; mobile flow pass |
| S1-BE-02 | P0 | Zweryfikować `sync_path/finalize` pod edge-case offline | Backend Dev | Scenariusz kill/relaunch opisany i zatwierdzony |
| S1-BE-03 | P1 | Przegląd retry policy i status codes (429/503) | Backend Dev | Jasne wytyczne dla mobile retry/backoff |
| S1-BE-04 | P1 | Uzgodnić payload dla leaderboard/trends | Backend Dev | Brak niejednoznaczności pól w UI |
| S1-BE-05 | P2 | Uzupełnić API docs dla wearables auth status | Backend Dev | Dokument API odzwierciedla realny flow |

## QA (manual + automation)

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-QA-01 | P0 | Smoke auth + ride lifecycle + gps recovery | QA Lead | 3 flowy pass i raport w ticketach |
| S1-QA-02 | P0 | Manual matrix deep-links (Android+iOS) | QA Engineer | Wszystkie krytyczne deeplinki zweryfikowane |
| S1-QA-03 | P1 | Dodać smoke dla settings sections | QA Engineer | Flow sekcji i persistence pass |
| S1-QA-04 | P1 | Dodać smoke dla explore map -> marketplace | QA Engineer | Nawigacja i fallback network pass |
| S1-QA-05 | P1 | Test regresji `ActivityDetail` po refaktorze | QA Engineer | Brak crash/placeholder regression |
| S1-QA-06 | P2 | Uzupełnić test notes dla device matrix | QA Lead | Minimum 2 Android + 1 iOS opisane |

## DevOps / Release

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-REL-01 | P0 | Ustawić policy env bez fallback do prod w release | Release Eng | Brak ryzyka prod fallback dla release |
| S1-REL-02 | P0 | Zweryfikować preview build i rollback path | Release Eng | Preview build gotowy, rollback opisany |
| S1-REL-03 | P1 | Potwierdzić telemetry/crash ingestion w preview | DevOps | Eventy crash/perf widoczne |
| S1-REL-04 | P1 | Ujednolicić release checklist EN/PL | Release Eng | `MOBILE.md` PL/EN zsynchronizowane |

## Data / Analytics

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-DATA-01 | P1 | Audyt eventów Ride/Auth/Share | Data Analyst | Braki eventów udokumentowane i przypisane |
| S1-DATA-02 | P1 | Potwierdzić metryki perf budget telemetry | Data Analyst | violation eventy mapowane i czytelne |
| S1-DATA-03 | P2 | Dodać rekomendacje retention eventów | Data Analyst | Lista eventów P2 do kolejnego sprintu |

## Design production

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-DES-01 | P0 | Audyt typografii PressStart2P/VT323 na kluczowych ekranach | UI Designer | Brak mismatch font family na Ride/Summary |
| S1-DES-02 | P1 | Usunąć emoji/placeholdery z ekranów detail/profile | UI Designer | Spójny chrome icon language |
| S1-DES-03 | P1 | Spójność kart (padding, border, shadow) | UI Designer | Pattern zatwierdzony na 3 ekranach |
| S1-DES-04 | P2 | Aktualizacja audytu Grand Prix EN/PL po zmianach | Technical Artist | Drift wpisany i status zaktualizowany |

## Security / Privacy / Compliance

| ID | Priorytet | Tytuł | Owner | Acceptance Criteria |
|----|-----------|-------|-------|---------------------|
| S1-SEC-01 | P0 | Audyt token storage i error logging | Security Eng | Brak wrażliwych danych w logach |
| S1-SEC-02 | P1 | Audyt privacy zones flow i fallbacków UI | Security Eng | UX nie sugeruje fałszywego success |
| S1-SEC-03 | P1 | Review konfiguracji env pod secret hygiene | Security Eng | Potwierdzony brak sekretów w kliencie |

---

## 4) Ticket template (kopiuj/wklej)

## Tytuł
`[S1][AREA][P0/P1/P2] Nazwa zadania`

## Kontekst
- Problem:
- Cel:

## Acceptance Criteria
- [ ] AC-1
- [ ] AC-2
- [ ] AC-3

## Evidence
- Testy:
- Screeny/nagrania:
- Docs updated:

## Ryzyko
- Potencjalny wpływ:
- Mitigation:

## Owner / ETA
- Owner:
- ETA:

---

## 5) Sprint exit criteria

- [ ] Wszystkie tickety P0 zamknięte lub z formalnym mitigation approved.
- [ ] `MOBILE_FULL_VISION_VERIFICATION` zielony.
- [ ] Cross-functional sign-off z `MOBILE_SPRINT1_REVIEW_PACKET`.
- [ ] Dokumentacja EN/PL zsynchronizowana dla zmian Sprint 1.
