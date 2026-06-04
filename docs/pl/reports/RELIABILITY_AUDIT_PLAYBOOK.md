# Podręcznik audytu niezawodności (administrator)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../reports/RELIABILITY_AUDIT_PLAYBOOK.md) |
| **canonical_path** | docs/pl/reports/RELIABILITY_AUDIT_PLAYBOOK.md |
---

Praktyczny playbook audytu niezawodnosci dla krytycznych flow administracyjnych. Cel: zatrzymac regresje typu konflikt wipe-data/simulator, rozjazdy FE/BE i bledy uprawnien przed releasem.

## 1) Cel i zakres

Zakres obejmuje krytyczne flow admina, gdzie blad ma wysoki koszt operacyjny:

- Wipe i symulacje:
  - `DELETE/GET /api/activities/admin/wipe-data/`
  - `POST/GET/DELETE /api/activities/admin/simulate/`
  - `POST/GET/DELETE /api/activities/admin/live-simulate/`
  - `POST /api/activities/admin/simulator-reset/`
- Zarzadzanie uzytkownikami:
  - `GET /api/users/` (cursor pagination)
  - `POST /api/users/bulk/set-status/`
  - `POST /api/users/bulk/change-role/`
  - `GET /api/users/bulk/jobs/<job_id>/`
- RBAC i guardy:
  - FE: `admin/src/core/guards/PermissionGuard.tsx`, routing w `admin/src/App.tsx`
  - BE: endpointy rbac (`/api/users/rbac/*`) i egzekucja uprawnien
- Moduly operacyjne:
  - `admin/src/modules/analytics/SimulatorPage.tsx`
  - `admin/src/modules/users/Users.tsx`
  - `admin/src/modules/settings/SettingsScreen.tsx`

## 2) Katalog ryzyk

### A. Contract mismatch FE/BE
- FE wysyla inne pole niz BE oczekuje (np. payload wipe/bulk).
- FE zaklada status/shape odpowiedzi, ktory zmienil sie po stronie API.
- Brak versioningu kontraktu dla endpointow krytycznych.

Kontrole:
- Snapshot kontraktow dla endpointow krytycznych w CI.
- Testy integracyjne FE->BE dla happy path + 4xx.

### B. Concurrency / idempotency
- Podwojony klik uruchamia drugi job wipe lub bulk.
- `409 Conflict` nieobsluzony poprawnie w FE (zly retry, brak pollingu statusu).
- Stare locki/job state blokuja kolejne uruchomienia.

Kontrole:
- Wymuszona idempotencja kluczowych akcji (wipe/bulk/sim start).
- Testy race (2 rownolegle requesty) i scenariusze stale job/force retry.

### C. Role mismatch (FE guard vs BE permissions)
- Route widoczna, ale backend odrzuca (403), albo odwrotnie.
- Sidebar/nav role niezgodne z `PermissionGuard` i backendowym RBAC.

Kontrole:
- Macierz rola -> route -> endpoint testowana automatycznie.
- E2E dla `GLOBAL_OWNER`, `TENANT_ADMIN`, `TENANT_MODERATOR`, `SPONSOR`.

### D. Scale
- Dziala dla dev-size, sypie sie przy duzych wolumenach (cursor pagination, bulk jobs, sim batch).
- Brak limitow/timeoutow i backpressure.

Kontrole:
- Testy wydajnosciowe na reprezentatywnym wolumenie.
- Budzety czasowe: p95/p99 dla endpointow krytycznych.

### E. Safety actions (destrukcyjne)
- Wipe uruchomiony w zlym srodowisku lub bez pelnej intencji operatora.
- Brak czytelnego audit trail dla kto/kiedy/co.

Kontrole:
- Silne potwierdzenie (fraza + MFA ack + rola).
- Twarde logowanie audit eventow i trace ID.

## 3) Standard testow przed release (must-pass matrix)

Kazdy release przechodzi ponizsza matryce (100% PASS):

1. Contract tests (API):
   - `wipe-data`, `simulate`, `live-simulate`, `simulator-reset`
   - `users list (cursor)`, `users bulk/*`, `users bulk/jobs/<id>`
2. Concurrency tests:
   - podwojne `DELETE wipe-data` -> jeden job aktywny, drugi dostaje kontrolowana odpowiedz
   - rownolegly start batch/live -> spodziewane `409` + poprawny komunikat
3. Role matrix tests:
   - FE route guard (`PermissionGuard`) zgodny z backend 403/200
4. E2E smoke (admin):
   - Users (cursor next/back + bulk action + job polling)
   - Simulator (start/status/stop)
   - Wipe (start/status + blokada konfliktowych flow)
5. Regression tests:
   - test reprodukujacy ostatni incident musi istniec i przechodzic

Minimalne artefakty do release:
- raport PASS/FAIL z CI,
- lista znanych odchylen (jesli sa) z akceptacja ownera release.

## 4) Go/No-Go checklist (release gate)

Go tylko gdy wszystkie punkty sa spelnione:

- [ ] Wszystkie joby blokujace merge/release sa zielone.
- [ ] Brak otwartych P0/P1 dla wipe/simulator/users/rbac.
- [ ] Macierz rol FE/BE bez niespojnosci.
- [ ] Dla endpointow krytycznych p95 i error-rate w normie.
- [ ] Alerty dla 409/5xx i stuck jobs sa aktywne.
- [ ] Jest wyznaczony release audit owner.

No-Go gdy:
- failuje dowolny test z matrycy must-pass,
- brak widocznosci operacyjnej (metryki/logi/trace),
- niezweryfikowany fix konfliktu wipe-data/simulator.

## 5) Incident runbook: 409 / lock / stuck wipe job

### Trigger
- Wzrost `409` dla:
  - `/api/activities/admin/wipe-data/`
  - `/api/activities/admin/simulate/`
  - `/api/activities/admin/live-simulate/`
- Wipe status stoi bez progresu lub job "running" zbyt dlugo.### Kroki operacyjne
1. Zweryfikuj status endpointow:
   - `GET /api/activities/admin/wipe-data/`
   - `GET /api/activities/admin/simulate/`
   - `GET /api/activities/admin/live-simulate/`
2. Zidentyfikuj konflikt:
   - czy batch/live lock jest trzymany,
   - czy wipe jest aktywny/stale.
3. Jesli lock/job jest stale:
   - uzyj kontrolowanego recovery: `POST /api/activities/admin/simulator-reset/`
   - wznow tylko jeden flow na raz (najpierw wipe complete, potem simulate).
4. Potwierdz zdrowie:
   - brak nowych `409` burst,
   - statusy endpointow przechodza do `idle/not running`.
5. Post-incident:
   - dopisz regression test dla scenariusza,
   - uzupelnij timeline: T0 wykrycie, T1 mitigacja, T2 recovery, T3 action items.

### Escalation
- 15 min bez poprawy -> owner backend + owner release.
- 30 min bez recovery -> rollback/feature freeze na flowach destrukcyjnych.

## 6) Observability minimum

### Logi (strukturalne)
Kazda akcja wipe/sim/bulk loguje:
- `event`, `endpoint`, `actor_user_id`, `tenant_id`, `job_id`, `trace_id`, `result`, `duration_ms`.

### Metryki
- `http_requests_total` i `http_request_duration_ms` dla endpointow krytycznych.
- `admin_wipe_running`, `admin_wipe_progress_pct`.
- `sim_batch_running`, `sim_live_running`, `sim_lock_held`.
- `users_bulk_jobs_running`, `users_bulk_job_duration_ms`.

### Alerty
- `409 rate` powyzej progu (5-10 min window).
- stuck wipe/sim/bulk job (czas > SLA).
- skok 5xx na endpointach admin krytycznych.

### Trace IDs
- FE przekazuje `X-Trace-Id` (lub analog), BE odsyla go w logach i bledach.
- Kazdy incydent musi byc korelowalny po `trace_id` end-to-end.

## 7) Integracja z CI (co blokuje merge)

Rekomendowane joby blokujace merge dla zmian dotykajacych admin critical paths:

- `backend-tests-critical`:
  - testy `backend/activities/test_wipe_flow.py`
  - testy symulatora i konfliktow 409
  - testy `backend/users/test_admin.py` (cursor + bulk)
- `frontend-tests-admin-critical`:
  - testy API client (`admin/src/api/client.ts`)
  - testy flow Users/Simulator/Settings (co najmniej smoke)
- `rbac-contract-check`:
  - walidacja mapy route guard vs backend permission matrix
- `observability-contract-check`:
  - czy endpointy krytyczne emituja wymagane pola log/metryk

Dodatkowo:
- PR label `critical-admin-flow` automatycznie wlacza powyzszy zestaw.
- Merge blokowany przy dowolnym FAIL.

## 8) Cadence i odpowiedzialnosc

- Weekly reliability review (30-45 min):
  - przeglad 409/5xx, stuck jobs, false-positive alertow, regressions.
- Release audit owner:
  - jedna osoba per release odpowiada za Go/No-Go, checklist i decyzje eskalacyjne.
- Miesiecznie:
  - przeglad trendow i update tej playbookowej listy ryzyk/testow.

---

## Quick start (dla zespolu)

Przed releasem wykonaj w tej kolejnosci:
1) must-pass matrix,  
2) Go/No-Go checklist,  
3) szybki dry-run incident runbook (tabletop 10 min),  
4) decyzja release audit ownera.
