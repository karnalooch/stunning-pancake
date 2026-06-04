# P2 — Plan działania panelu administracyjnego (po P1)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../admin/P2_ROADMAP.md) |
| **canonical_path** | docs/pl/admin/P2_ROADMAP.md |
---

| | |
|--|--|
| **Status** | ✅ Active — planowanie; implementacja **po** domknięciu P1 Paczki 1b operacyjnie |
| **Owner role** | Admin / Backend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Admin developers, Platform Operator, Release Manager, DPO |
| **Standard** | [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md) |
| **Poprzednik** | [P1_ROADMAP.md](./P1_ROADMAP.md) (Paczki 1–6) |
| **Post-deploy gate** | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |

---

## 1. Zakres P2 (decyzja 2026-06-03)

**P2** to osobny tor roadmapy **obok** sekwencji paczek P1 — nie jest to „Paczka 6” w całości.

| Tor P2 | Opis | Powiązanie P1 |
|--------|------|----------------|
| **GPX & activity forensics** | Eksport, archiwum, anty-cheat batch, forensics ops, RODO ZIP, retencja | Odłożone z wczesnego slice **1c** → P2 |
| **Auth / MFA** | 2FA, hardening wipe, impersonation audit | Było **Paczka 6** w P1 — szczegóły §4 |

**Decyzja produktowa:** GPX **nie jest wymagany** do zakończenia jazdy (real ani symulowanej). Źródło prawdy pozostaje `Activity.route_path` (PostGIS) + pipeline weryfikacji. GPX to **artefakt pochodny** (download, archiwum, compliance, dochodzenie).

Pełna lista use-case’ów GPX (żeby nic nie umknęło): **§2.3**.

---

## 2. GPX & activity forensics

### 2.1 Zależności i kolejność

| Warunek | Uzasadnienie |
|---------|--------------|
| **Po** P1 Paczka **1b** (backpressure + sim KPI) | Skala live sim stabilna przed archiwizacją tras |
| **Przed lub równolegle** z Paczka **5** (Moderator queue) | Załącznik GPX + mapa w case moderacji |
| SSOT weryfikacji | [ARCHITECTURE.md](../ARCHITECTURE.md) · [operations/BROUTER.md](../../operations/BROUTER.md) |
| RODO / eksport | [CONSTITUTION.md](../../CONSTITUTION.md) §8.3 |

### 2.2 Fazy implementacji (F1–F6)

| Faza | Nazwa | Cel (skrót) | Gate |
|------|-------|-------------|------|
| **F1** | On-demand download | `GET /api/activities/{id}/gpx/` z `route_path` | Brak wymogu object storage |
| **F2** | Async archiwum | Po verified → S3/R2 + `gpx_sha256` | Idempotencja po hash `route_path` |
| **F3** | Anty-cheat (batch) | Re-verify, fingerprint, kinematyka, metadane | Nie zastępuje live BRouter/pluginów |
| **F4** | Forensics / CI | OOM replay, golden GPX, routing failures | Overlap z ops + release gate |
| **F5** | Bulk export RODO | `GET /api/users/me/export/` → ZIP | [CONSTITUTION.md](../../CONSTITUTION.md) §8.3 |
| **F6** | Import upload | GPX → nowa aktywność (Strava/Garmin-style) | **Opcjonalny P2+** — osobny produkt |

#### Faza 1 — on-demand download (MVP)

| Element | Spec |
|---------|------|
| Endpoint | `GET /api/activities/{id}/gpx/` |
| Źródło | Generacja z `route_path` (`gpxpy` / GeoDjango → GPX 1.1) |
| RBAC | Właściciel aktywności + admin GO / tenant scope |
| Admin UI | Opcjonalnie „Pobierz GPX” przy debugu jazdy (sim + real) |
| Test | Jedna jazda bike z LineString → plik z `<trkpt lat lon>` |

#### Faza 2 — async archiwum (verified complete)

| Element | Spec |
|---------|------|
| Trigger | Po `is_verified=True` (lub równoważny stan COMPLETED + verified path) |
| Task | `generate_gpx_task` (Celery, queue `default`) |
| Storage | S3/R2: `activities/{id}.gpx` + `metadata.json` |
| Pola DB | `Activity.gpx_storage_key`, `gpx_sha256`, opcjonalnie `gpx_generated_at` |
| Idempotencja | Ten sam `route_path` hash → skip rewrite |

#### Faza 3 — anty-cheat (batch & fingerprint)

GPX **nie zastępuje** live anty-cheatu (BRouter + pluginy) — to **archiwum do dochodzenia** i **batch re-check**.

| Job / use case | Cel |
|----------------|-----|
| `reverify_gpx_batch` | Po update BRouter / nowych progach — ponowny `process_activity` na archiwum |
| Duplicate route fingerprint | Hash polyline / fingerprint — bot farm, copy-paste GPX |
| Kinematic anomalies | Prędkość między `<trkpt>`, teleporty, nierealistyczne przyspieszenia — uzupełnienie `ml_anomaly` |
| Metadata mismatch | Dystans GPX vs `Activity.distance` vs BRouter vs czas → flaga moderatora |
| Wearables cross-check | `external_id` Strava/Garmin vs wygenerowany GPX |
| Sim vs real | `simulated=true` — sim GPX **nigdy** w rankingu athlete bez jawnej etykiety |

**Powiązane:** moduł Anti-Cheat SOC w admin · [RBAC.md](../../RBAC.md).

#### Faza 4 — system failure forensics| Use case | Przykład |
|----------|----------|
| Post-mortem OOM/SIGKILL | GPX przy COMPLETED vs częściowa jazda po utracie Redis FSM |
| FSM / `live_tick` debug | GPX końcowy vs ostatni snapshot telemetry w Redis |
| Routing failures | GPX przy `FAILED_UNROUTABLE` + log BRouter |
| Golden files CI | Zestaw referencyjnych GPX → po release % verified nie spada |
| Sim vs Redis replay | Ten sam golden GPX → deterministyczny wynik weryfikacji w testach |
| Support GO | Sporne km — pobranie GPX + lokalny replay pipeline |

Runbooki: [operations/SIMULATOR.md](../../operations/SIMULATOR.md) · [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md).

#### Faza 5 — RODO bulk export (CONSTITUTION)

| Element | Spec |
|---------|------|
| Endpoint | `GET /api/users/me/export/` (async) |
| Format | ZIP: JSON profilu + **GPX per aktywność** |
| Task | `export_user_data_task` — link ważny 24 h |
| SSOT | [CONSTITUTION.md](../../CONSTITUTION.md) §8.3 — prawo do przenoszenia |
| Compliance | [compliance/RCP.md](../../compliance/RCP.md) |

**Uwaga:** Faza 5 może startować równolegle z Fazą 1 (ten sam generator GPX), ale pełny ZIP wymaga stabilnego kontraktu eksportu.

#### Faza 6 — import upload (opcjonalny P2+)

| Element | Spec |
|---------|------|
| Scope | Upload GPX z zewnętrznego źródła → nowa `Activity` (import Strava/Garmin) |
| Status | **Nie** w core P2 F1–F5; osobny tor produktowy po stabilnym eksporcie |
| Non-goal | Upload **nie** jako warunek `finish` jazdy w aplikacji |

---

### 2.3 Backlog możliwości — pełna checklista

Checklist z rozmowy produktowej (2026-06-03). Kolumna **Faza** wskazuje domyślne mapowanie na §2.2; pozycje bez fazy mogą wejść równolegle (np. Paczka 5).

**Legenda:** ☐ = do zrobienia w P2 · — = poza core slice / później

#### 2.3.1 Anty-cheat / oszuści

| ☐ | Use case | Opis | Faza |
|---|----------|------|------|
| ☐ | Offline re-weryfikacja | Po zmianie BRouter / reguł — batch Celery `reverify_gpx_batch` na archiwum GPX | F3 |
| ☐ | Anomalie kinematyczne | Prędkość między trackpointami, teleport, nierealistyczne przyspieszenie — **uzupełnienie** `ml_anomaly`, nie duplikat | F3 |
| ☐ | Duplikat trasy (fingerprint) | Hash polyline / fingerprint — bot farmy, copy-paste GPX między kontami | F3 |
| ☐ | Niespójność metadanych | Dystans GPX vs `Activity.distance` vs BRouter vs duration → flaga do kolejki moderatora | F3 · [Paczka 5](./P1_ROADMAP.md#4-paczki-36-skrót) |
| ☐ | Cross-check wearables | `external_id` Strava/Garmin vs GPX wygenerowany z `route_path` | F3 |
| ☐ | Simulator vs real | `simulated=true` w metadanych GPX / `Activity`; **nigdy** ranking athlete bez jawnej etykiety | F2–F3 |

#### 2.3.2 Awarie systemu / debug

| ☐ | Use case | Opis | Faza |
|---|----------|------|------|
| ☐ | Post-mortem OOM/SIGKILL | Porównanie częściowej jazdy vs finalny GPX po utracie workerów / Redis | F4 |
| ☐ | Replay `live_tick` / FSM | GPX końcowy vs ostatnia telemetria w Redis — wykrycie bugów tick/FSM | F4 |
| ☐ | Forensics routingu | `FAILED_UNROUTABLE` + logi BRouter + GPX — OSM vs bug dispatch | F4 |
| ☐ | Golden set w CI | Regresja po release — zestaw referencyjnych GPX, % verified nie spada | F4 |
| ☐ | Support GO — sporne km | Pobranie GPX przy sporze o dystans / weryfikację | F1 · F4 |

#### 2.3.3 Produkt, compliance, dane (inne)

| ☐ | Use case | Opis | Faza |
|---|----------|------|------|
| ☐ | RODO — przenoszenie danych | ZIP profil + GPX: `GET /api/users/me/export/` — [CONSTITUTION.md](../../CONSTITUTION.md) §8.3 | F5 |
| ☐ | Kolejka moderatora | Załącznik mapa + GPX w case — integracja [Paczka 5](./P1_ROADMAP.md#4-paczki-36-skrót) | F1 · overlap 5 |
| ☐ | Retraining ML | Historyczne GPX do modeli anomalii (`ml_anomaly`) | F3 · — |
| ☐ | Jakość mapy / BRouter | Agregacja problematycznych segmentów (bez PII) z failed/unroutable + GPX | F4 · — |
| ☐ | Walidacja heatmapy | Unia GPX vs heatmapa w DB — wykrycie driftu | — |
| ☐ | Udostępnianie społecznościowe | Uproszczony GPX ze stref prywatności wyciętych | F1 · — |
| ☐ | Integralność czasu eventu | Timestampy GPX vs okno czasowe eventu | F3 · — |
| ☐ | Retencja warstwowa | Surowy GPX ~90 dni (forensics); potem tylko hash + statystyki | F2 · [CONSTITUTION.md](../../CONSTITUTION.md) §8.2 |

#### 2.3.4 Mapowanie checklista → fazy (macierz)| Faza | Zakres checklisty (§2.3) |
|------|---------------------------|
| F1 | On-demand GET, GO support download, moderator preview (read) |
| F2 | S3 archiwum, `gpx_sha256`, retencja 90d → hash+stats |
| F3 | Re-verify batch, fingerprint, kinematyka, metadata, wearables, sim tag, event time, ML retrain input |
| F4 | OOM/FSM/routing forensics, golden CI, BRouter quality aggregate |
| F5 | RODO ZIP export |
| F6 | Import upload (opcjonalny) |

---

### 2.4 Jawne non-goals (P2 core)

| Non-goal | Uzasadnienie |
|----------|--------------|
| GPX wymagany do `finish` jazdy | `route_path` + live pipeline wystarczą; GPX artefakt pochodny |
| `route_path` nie jest źródłem prawdy | **Źródło prawdy:** PostGIS `route_path` + weryfikacja BRouter |
| GPX co tick (surowa telemetria) | Brak per-second storage; retencja zgodnie z [CONSTITUTION.md](../../CONSTITUTION.md) §8.2 |
| Import GPX w core P2 | F6 — osobny tor P2+ (Strava/Garmin import) |

---

### 2.5 Architektura docelowa (skrót)```text
Mobile/Sim → GPS/punkty → route_path (SSOT) → finalize → verify (BRouter)
                                    ↓
                         F1: GET …/gpx/ (on-demand)
                                    ↓
                         F2: generate_gpx_task → S3/R2 + gpx_sha256
                                    ↓
              F3: reverify · fingerprint · kinematyka · wearables · sim tag
                                    ↓
              F4: OOM/FSM forensics · golden CI · routing failures
                                    ↓
                         F5: export_user_data_task → ZIP (RODO)
                                    ↓
                         F6: import upload (opcjonalny P2+)
```---

## 3. Kolejność względem P1```text
P1: 1a ✅ → 1b ✅ → 2 Sponsor → 3 GO tooling → 4 Tenant Admin → 5 Moderator → 6 Auth (skrót w P1)
P2 GPX: F1–F2 (core) ──► F3 anty-cheat ──► F4 forensics ──► F5 RODO ZIP ──► F6 import (opcjonalnie)
         ↑ start po 1b                          ↑ overlap z Paczka 5 (mapa + GPX w inbox)
P2 Auth/MFA: po Paczka 4 lub równolegle (ryzyko security — priorytet dla GO)
```---

## 4. Auth / MFA (ex-P1 Paczka 6)

Szczegóły implementacji Auth przeniesione z [P1_ROADMAP.md §4](./P1_ROADMAP.md#4-paczki-36-skrót) — realizacja w torze P2 **po** paczkach produktowych P1 (5–6 w kolejności P1, lub równolegle gdy zespół auth oddzielny).

| Kryterium | Opis |
|-----------|------|
| MFA / 2FA | TOTP (lub WebAuthn — decyzja przy kickoff); wymuszenie dla `GLOBAL_OWNER` |
| Wipe safety | Typed env phrase + MFA ack — zgodnie z [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) § Wipe |
| Impersonation audit | `POST /users/impersonate/<id>/` — tylko `GLOBAL_OWNER`; middleware audit; UI sandbox |
| Settings | Sekcja MFA w admin Settings — persist do API |
| Testy | `test_impersonation_requires_global_owner` + smoke MFA flow |

**Powiązane:** [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md) § Wipe / Impersonation · [RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md).

---

## 5. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [P1_ROADMAP.md](./P1_ROADMAP.md) | Aktywna sekwencja paczek 1–6; GPX odłożone → §2 tutaj |
| [CONSTITUTION.md](../../CONSTITUTION.md) | GPX w eksporcie RODO; retencja; Celery dla przetwarzania GPX |
| [DATA_RESILIENCE.md](../DATA_RESILIENCE.md) | `route_path` vs telemetry — kontekst forensics |
| [operations/SIMULATOR.md](../../operations/SIMULATOR.md) | Sim FSM, `simulated` tagging |
| [compliance/RCP.md](../../compliance/RCP.md) | Rejestr czynności RODO |

---

## 6. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-03 | Pełna checklista GPX (§2.3): anty-cheat, forensics, RODO, retencja; fazy F1–F6; non-goals |
| 2026-06-03 | Utworzenie P2; GPX forensics (F1–F5) + Auth/MFA ex-Paczka 6; decyzja: GPX nie blokuje finish |
