# Mobile Cross-Functional Review Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Product Manager |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Product trio, engineering, QA, DevOps, design, security |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md) |
| **canonical_path** | docs/pl/operations/MOBILE_CROSS_FUNCTIONAL_REVIEW_PLAYBOOK.md |
| **Powiązane** | [MOBILE_STARTUP_HARDENING_PLAYBOOK.md](./MOBILE_STARTUP_HARDENING_PLAYBOOK.md) · [MOBILE_FIX_FORWARD_PLAYBOOK.md](./MOBILE_FIX_FORWARD_PLAYBOOK.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md](../design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md) |

---

## Cel

Każda rola w zespole wykonuje przegląd warstwy mobile przez swój "kąt odpowiedzialności" i aktualizuje wskazaną dokumentację. Efekt: mniej poprawek na starcie, szybsze review PR i mniej regresji po release.

---

## 1) Workflow wspólny (dla każdej roli)

1. Przejrzyj przypisany zakres mobile.
2. Zgłoś findings w formacie: `Issue / Impact / Recommendation / Owner`.
3. Oznacz poziom: `P0` (blokuje), `P1` (wysokie), `P2` (jakość).
4. Zaktualizuj przypisane dokumenty.
5. Dodaj datę przeglądu i ownera do changelogu zespołu/release notes.

---

## 2) Zakres przeglądu per rola

## Product trio (PM + UX/UI + Tech Lead)

- **Sprawdza:** zgodność flow użytkownika z full vision, priorytety P0/P1, kompromisy scope/time.
- **Warstwa mobile:** `mobile/src/screens/*`, `mobile/src/app/NavigationShell.tsx`, `mobile/src/navigation/*`.
- **Aktualizuje:** 
  - `docs/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/pl/design/4VELO_MOBILE_FULL_VISION_IMPLEMENTATION.md`
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (status wymagań).

## Mobile team (RN / iOS / Android)

- **Sprawdza:** architekturę modułów, nawigację, lifecycle jazdy, edge states, i18n parity.
- **Warstwa mobile:** `mobile/src/app/*`, `mobile/src/features/*`, `mobile/src/screens/*`, `mobile/src/components/*`, `mobile/src/i18n/*`.
- **Aktualizuje:**
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md` (gdy zmieniają się bramy jakości).

## Backend/API team

- **Sprawdza:** kontrakty API, auth refresh, retry, sync_path/finalize, obsługa błędów.
- **Warstwa mobile:** `mobile/src/services/api.ts`, `apiClient.ts`, `apiRetry.ts`, `rideSessionService.ts`, `GpsSyncManager.ts`.
- **Aktualizuje:**
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/pl/API.md` / `docs/API.md` (jeśli zmieniają się endpointy/kontrakty)
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (FR/NFR mapping).

## QA (manual + automation)

- **Sprawdza:** smoke krytycznych flow, GPS edge-case, offline/reconnect, deep links, cross-device sanity.
- **Warstwa mobile:** `mobile/.maestro/flows/*`, flow auth/ride/gps/settings/map/profile.
- **Aktualizuje:**
  - `docs/pl/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/en/operations/MOBILE_FULL_VISION_VERIFICATION.md`
  - `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md` (nowe klasy incydentów/regresji).

## DevOps / Release

- **Sprawdza:** env readiness, build profiles, release pipeline, rollback, observability.
- **Warstwa mobile:** `mobile/app.config.js`, `mobile/eas.json`, release scripts, telemetry toggles.
- **Aktualizuje:**
  - `docs/pl/operations/MOBILE.md`
  - `docs/en/operations/MOBILE.md`
  - `docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md`.

## Data / Analytics

- **Sprawdza:** event tracking quality, brakujące eventy produktu, wydajność i funnel retention.
- **Warstwa mobile:** `mobile/src/services/EngagementAnalytics.ts`, `FirebaseService.ts`, `performanceBudget.ts`.
- **Aktualizuje:**
  - `docs/design/MOBILE_REQUIREMENTS_TRACEABILITY_MATRIX.md` (NFR observability)
  - runbook/perf section w `MOBILE_FULL_VISION_VERIFICATION.md`.

## Design production (graphic / illustrator / technical artist)

- **Sprawdza:** spójność ikon/assetów, integer scaling, styl kart i HUD, brak placeholderów/emoji.
- **Warstwa mobile:** `mobile/src/assets/*`, `mobile/src/components/ui/*`, `mobile/src/theme/*`, `mobile/src/components/ride/*`.
- **Aktualizuje:**
  - `docs/design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md`
  - `docs/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`
  - `docs/pl/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md`.

## Security / Privacy / Compliance

- **Sprawdza:** token handling, privacy zones, brak sekretów, ekspozycja danych i logging.
- **Warstwa mobile:** `mobile/src/services/authTokenStorage.ts`, `apiClient.ts`, `SettingsScreen.tsx`, privacy API flows.
- **Aktualizuje:**
  - `docs/pl/CONSTITUTION.md` (jeśli zmiana zasad)
  - `docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md` (security incident response)
  - odpowiednie dokumenty compliance.

---

## 3) Kryteria decyzji GO/NO-GO per rola (quick gate)

| Rola | GO jeśli | NO-GO jeśli | Minimalne evidence |
|------|----------|-------------|--------------------|
| Product trio | Potwierdzone IN/OUT i AC dla Ride/Explore/Profile | Brak potwierdzonego scope lub konflikt AC | Zaktualizowany spec + wpis w sign-off sheet |
| Mobile | `tsc` zielone, kluczowe testy zielone, brak nowych P0 | Crash/regresja P0 w ride/auth/sync | Wyniki `tsc` + testy + link do PR |
| Backend/API | Kontrakty API i retry/auth refresh potwierdzone | Niezgodny kontrakt blokujący mobile | Notatka kontraktowa + update API/DATA docs |
| QA | Smoke i manual matrix pass na wymaganym zakresie | Krytyczny scenariusz nieprzechodzący lub brak coverage | Raport smoke + matrix device/deep-link/offline |
| DevOps/Release | Preview build + rollback + telemetry/crash potwierdzone | Brak rollback path albo niestabilny build release | Log builda + checklist release |
| Data/Analytics | Krytyczne eventy i metryki perf widoczne | Brak eventów P0 lub brak obserwowalności NFR | Query/screenshot eventów + update matrix |
| Design production | Brak driftu chrome/HUD, brak placeholderów | Widoczny drift UI lub placeholder w flow P0 | Aktualizacja audytu Grand Prix + screeny |
| Security/Privacy | Token/log/privacy checklist zamknięta | Ryzyko wycieku danych lub niespełniona privacy ścieżka | Checklist security + decyzja ownera |

**Reguła nadrzędna:** pojedyncze `NO-GO` dowolnej roli zatrzymuje release do czasu mitigation i ponownego review.

---

## 4) Częstotliwość i definition of done

## Częstotliwość

- Przegląd cross-funkcyjny: minimum raz na sprint.
- Przegląd rozszerzony: przed każdym release candidate.
- Przegląd incydentowy: po każdym P0/P1.

## Done, gdy:

- Każda rola ma zamkniętą checklistę i wpisane findings.
- P0 są rozwiązane lub mają formalny plan mitigation.
- Traceability matrix i runbooki mają aktualną datę i ownerów.
- Release gate (`MOBILE_FULL_VISION_VERIFICATION`) jest zielony.

---

## 5) Sugerowany format wpisu review (do PR/release notes)

`[Role] [Date] [Scope] [Findings P0/P1/P2] [Docs updated] [Owner]`

Przykład:

`[QA] 2026-06-14 [ride lifecycle + gps recovery] [P1: flaky deep link on Android 14] [updated MOBILE_FULL_VISION_VERIFICATION] [owner: qa-lead]`
