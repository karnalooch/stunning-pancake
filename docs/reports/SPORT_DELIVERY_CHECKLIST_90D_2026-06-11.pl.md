# 4VELO / SPORT — delivery checklist (90 dni)

| | |
|--|--|
| **Status** | Active |
| **Data** | 2026-06-11 |
| **Owner role** | Product / Delivery Lead |
| **Audience** | Zespół produktowy, sprint planning |
| **lang** | pl |
| **translation** | [English](../en/reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.en.md) |
| **canonical_path** | docs/reports/SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.pl.md |
| **Pełny raport** | [SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md) |

---

Lista wdrożeniowa do bezpośredniego przepisania na sprinty. Kolejność oddaje priorytet (szybki dowód komercyjny → produkt → skala). Każda pozycja ma outcome (kryterium "done").

## Jak czytać

- `[ ]` — do zrobienia.
- **Outcome** — co musi być prawdą, by uznać pozycję za zamkniętą.
- Tier 0–1b to minimum do pierwszej płatnej ligi / pierwszego kontraktu JST.

---

## Tier 0 — GTM / trust (głównie dokumentacja, tydzień 1–3)

> **Iteracja 1 (sales kit) — 2026-06-12** · **Iteracja 2 (domknięcie) — 2026-06-12:** [docs/gtm/README.md](../gtm/README.md)

- [x] Ograniczenie produktu do **rower / bieg / nordic walking** (UI, API, regulamin, materiały sprzedażowe).
  - Outcome: w aplikacji i dokumentacji widoczne wyłącznie te 3 dyscypliny.
  - **Done:** enforcement API (`core/sport_scope.py`, serializer), mobile picker (`RideDashboardScreen`), GTM — [gtm/pl/campaign-start/](../gtm/pl/campaign-start/)
- [x] Pakiet "start kampanii" dla tenanta (plakaty, regulamin, FAQ GPS/bateria, harmonogram).
  - Outcome: jeden folder materiałów, które tenant dostaje przy onboardingu.
  - **Done:** [gtm/pl/campaign-start/](../gtm/pl/campaign-start/) · [gtm/en/campaign-start/](../gtm/en/campaign-start/)
- [x] Publiczna strona Anti-Cheat / Scoring Policy.
  - Outcome: URL z jawnym opisem normalizacji i przesłanek dyskwalifikacji.
  - **Done:** `{admin-domain}/#/trust/anti-cheat` · [gtm/pl/trust/ANTI_CHEAT_SCORING_POLICY.md](../gtm/pl/trust/ANTI_CHEAT_SCORING_POLICY.md)
- [x] Runbook peak event + jednostronicowy raport z symulacji (10k–300k).
  - Outcome: dokument odpowiadający na pytanie "co przy RSP-weekend".
  - **Done:** [RSP_WEEKEND_RUNBOOK.md](../gtm/pl/operations/RSP_WEEKEND_RUNBOOK.md) · [SCALE_PROOF_ONE_PAGER.md](../gtm/pl/operations/SCALE_PROOF_ONE_PAGER.md)
- [x] Szablon DPIA + lista podprocesorów per tenant.
  - Outcome: gotowy template do podpisania z miastem/firmą.
  - **Done:** [DPIA_TEMPLATE.md](../gtm/pl/compliance/DPIA_TEMPLATE.md) · [SUBPROCESSORS_TEMPLATE.md](../gtm/pl/compliance/SUBPROCESSORS_TEMPLATE.md)
- [x] Mechanizm komunikacji incydentów in-app (nie tylko mail).
  - Outcome: baner/komunikat sterowany z backendu.
  - **Done:** `PlatformNotice` + `GET /api/core/notices/active/` + admin CRUD + `PlatformNoticeBanner` (mobile)
- [x] Pitch deck / one-pager PL i EN.
  - Outcome: gotowe do wysłania do decydenta (bazuje na exec one-pager).
  - **Done:** [ONE_PAGER.md](../gtm/pl/ONE_PAGER.md) · [PITCH_DECK.pptx](../gtm/pl/PITCH_DECK.pptx) · [EN](../gtm/en/PITCH_DECK.pptx)

## Tier 1 — produkt mobilny civic (tydzień 2–7)

- [x] CityHub na live API (zamiast mocków), sync z sezonem.
  - Outcome: `CityHubScreen` pokazuje realne dane eventu.
- [x] Onboarding "wybierz miasto / dział / zespół" (3 kroki).
  - Outcome: nowy user dołącza do rywalizacji bez supportu.
- [x] Wizard "problemy z GPS" w appce (zielone/czerwone checki).
  - Outcome: ekran diagnostyczny baterii/uprawnień/tła.
- [x] Share do social z gotową grafiką.
  - Outcome: jeden tap → obraz z wynikiem.
- [x] Push: ranking miasta / quest / koniec sezonu.
  - Outcome: minimum 3 typy powiadomień retencyjnych.
- [x] Offline / słaby zasięg (potwierdzenie outbox w produkcji).
  - Outcome: aktywność zapisana offline trafia do serwera po powrocie sieci.

## Tier 1b — minimum do pierwszej płatnej ligi (klub/firma, tydzień 4–9)

Mobile:
- [ ] Club Detail + join + challenge accept (zastąpić placeholder `ClubsDirectoryScreen`).
  - Outcome: user przegląda klub, dołącza, akceptuje wyzwanie.
- [ ] "Moja liga" / Battle screen (Ty vs Oni, pasek postępu, countdown).
  - Outcome: ekran 1v1 oparty na `ClubChallenge` / `CLUB_BATTLE`.
- [ ] Invite flow (link/kod do klubu lub ligi).
  - Outcome: dołączenie przez link bez ręcznego dodawania.
- [ ] Push "klub przegrywa o X km — zostało N dni".
  - Outcome: powiadomienie wyzwalane stanem wyzwania.

Admin:
- [ ] Kreator sezonu (nazwa, daty, typ 1v1/liga, sport, normalizacja, publikacja).
  - Outcome: organizator tworzy sezon bez wsparcia developera.
- [ ] Zaproszenie przeciwnika (status PENDING → ACTIVE jak `ClubChallenge`).
  - Outcome: druga strona akceptuje wyzwanie w panelu.
- [ ] Raport końca sezonu (PDF: ranking, fair-play flags, uczestnictwo %).
  - Outcome: jeden plik do wysłania HR / kapitanowi.

Trust:
- [ ] Publiczna polityka scoringu spięta z UI sezonu.
  - Outcome: link do polityki widoczny przy rywalizacji.

## Tier 2 — TENANT_ADMIN (tydzień 6–10)

- [ ] Eksport "raport dla burmistrza/HR" (PDF/CSV: km, uczestnicy, heatmapa, CO₂).
  - Outcome: eksport jednym kliknięciem.
- [ ] Heatmapy jako wartość premium dla tenanta (nie tylko GO).
  - Outcome: tenant z pakietem widzi heatmapę.
- [ ] Workflow "opublikuj sezon / zamknij sezon" (draft → live → archiwum).
  - Outcome: pełen lifecycle sezonu z rankingiem finalnym.
- [ ] Playwright smoke jako TENANT_ADMIN.
  - Outcome: test pokrywa ścieżkę admina tenanta.
- [ ] Pomiar moderacji <60s w produkcji.
  - Outcome: metryka czasu od zgłoszenia do decyzji.

## Tier 2b — skalowanie B2B (po pierwszych pilotach)

- [ ] SSO / SCIM dla dużych firm.
- [ ] Liga wielofirmowa (organizer tenant + tenanci-dzieci).
- [ ] Department leaderboard w mobile.
- [ ] Rola "kapitan" (między user a moderator).
- [ ] Integracja kalendarza (Outlook/Google) dla startu/końca sezonu.

## Tier 3 — GLOBAL_OWNER / platforma (gdy multi-tenant rośnie)

- [ ] Action Inbox (pending + anti-cheat + infra + sim).
- [ ] Tenant Command Center (sparklines, churn signals).
- [ ] Impersonation + audit (support bez raw SQL).
- [ ] Feature flags GO-only.
- [ ] Rozdzielenie prod vs sim na dashboardach.

## Tier 3b — kluby hardcore (później)

- [ ] Eventy CHECKPOINT / ROUTE_MATCH (biegi klubowe z POI).
- [ ] Segmenty KOM ("segment wars").
- [ ] Matrix chat klubu w UI (provisioning już istnieje).

## Świadomie poza zakresem 90 dni

- [ ] Pełny bracket play-off (dopiero przy 10+ ligach z play-offami).
- [ ] Płatności entry fee w app (regulacja konkursów/hazardu).
- [ ] Move-to-earn / crypto.
- [ ] Dyscypliny poza rower / bieg / nordic walking (np. 18 dyscyplin AM, wellness tylko na krokach).

---

## Piloty (kamienie milowe)

- [ ] **Pilot A — firma wewnętrzna:** 4 działy, 6 tygodni, jeden tenant.
  - Outcome: zamknięty sezon + raport HR + zero ręcznej interwencji developera.
- [ ] **Pilot B — klub 1v1:** dwa kluby (bieg lub rower), 30 dni.
  - Outcome: zakończony pojedynek z fair scoring + case study.
- [ ] **Następny krok:** liga wielofirmowa (organizer tenant) na bazie wniosków z pilotów.

---

## Źródło i zakres

Checklista pochodzi z rekomendacji w [pełnym raporcie](./SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md) (sekcje 11–12) i nie wprowadza tez sprzecznych z raportem. Skrót decyzyjny: [exec one-pager](./SPORT_EXEC_ONE_PAGER_2026-06-11.pl.md).
