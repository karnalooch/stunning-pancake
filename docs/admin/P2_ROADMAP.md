# P2 — Roadmap panelu admin (post-P1)

| | |
|--|--|
| **Status** | ✅ Active — planowanie; implementacja **po** domknięciu P1 Paczki 1b operacyjnie |
| **Owner role** | Admin / Backend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Admin developers, Platform Operator, Release Manager, DPO |
| **Standard** | [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) |
| **Poprzednik** | [P1_ROADMAP.md](./P1_ROADMAP.md) (Paczki 1–6) |
| **Post-deploy gate** | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |

---

## 1. Zakres P2 (decyzja 2026-06-03)

**P2** to osobny tor roadmapy **obok** sekwencji paczek P1 — nie jest to „Paczka 6” w całości.

| Tor P2 | Opis | Powiązanie P1 |
|--------|------|----------------|
| **GPX & activity forensics** | Eksport, archiwum, anty-cheat batch, forensics ops, RODO ZIP | Odłożone z wczesnego slice **1c** → P2 |
| **Auth / MFA** | 2FA, hardening wipe, impersonation audit | Było **Paczka 6** w P1 — szczegóły §3 |

**Decyzja produktowa:** GPX **nie jest wymagany** do zakończenia jazdy (real ani symulowanej). Źródło prawdy pozostaje `Activity.route_path` (PostGIS) + pipeline weryfikacji. GPX to **artefakt pochodny** (download, archiwum, compliance).

**Symulator:** jazdy symulowane muszą być oznaczone `simulated=true` w metadanych GPX / `Activity` — **nie** mieszać z rankingiem athlete bez jawnej etykiety.

---

## 2. GPX & activity forensics

### 2.1 Zależności i kolejność

| Warunek | Uzasadnienie |
|---------|--------------|
| **Po** P1 Paczka **1b** (backpressure + sim KPI) | Skala live sim stabilna przed archiwizacją tras |
| **Przed lub równolegle** z Paczka **5** (Moderator queue) | Załącznik GPX + mapa w case moderacji |
| SSOT weryfikacji | [ARCHITECTURE.md](../ARCHITECTURE.md) · [operations/BROUTER.md](../operations/BROUTER.md) |
| RODO / eksport | [CONSTITUTION.md](../CONSTITUTION.md) §8.3 |

### 2.2 Fazy implementacji

#### Faza 1 — on-demand download (MVP)

| Element | Spec |
|---------|------|
| Endpoint | `GET /api/activities/{id}/gpx/` |
| Źródło | Generacja z `route_path` (`gpxpy` / GeoDjango → GPX 1.1) |
| RBAC | Właściciel aktywności + admin GO / tenant scope |
| Admin UI | Opcjonalnie „Pobierz GPX” przy debugu jazdy (sim + real) |
| Test | Jedna jazda bike z LineString → plik z `<trkpt lat lon>` |

**Gate:** brak wymogu zapisu w object storage — wystarczy generacja przy żądaniu.

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
| `reverify_gpx_batch` | Po update BRouter / nowych progach — ponowny `process_activity` na archiwum bez mutacji prod na żywo |
| Duplicate route fingerprint | Hash polyline / fingerprint — ta sama trasa w wielu kontach (bot farm, copy-paste) |
| Kinematic anomalies | Prędkość między `<trkpt>`, teleporty, nierealistyczne przyspieszenia — uzupełnienie `ml_anomaly` |
| Metadata mismatch | Dystans GPX vs `Activity.distance` vs BRouter vs czas → flaga do [Paczka 5](./P1_ROADMAP.md#4-paczki-36-skrót) moderator inbox |
| Sim vs real | Filtr `simulated=true` — sim GPX wyłączony z rankingów athlete |

**Powiązane:** moduł Anti-Cheat SOC w admin · [RBAC.md](../RBAC.md).

#### Faza 4 — system failure forensics

| Use case | Przykład |
|----------|----------|
| Post-mortem OOM/SIGKILL | GPX przy COMPLETED pokazuje, gdzie jazda/sim faktycznie skończyła po utracie Redis FSM |
| FSM / `live_tick` debug | GPX końcowy vs ostatni snapshot telemetry w Redis — zgodność z Live Map |
| Routing failures | GPX przy `FAILED_UNROUTABLE` + log BRouter — dane OSM vs bug dispatch |
| Golden files CI | Zestaw referencyjnych GPX z prod/staging → po release % verified nie spada |
| Sim vs Redis replay | Ten sam GPX golden file → deterministyczny wynik weryfikacji w testach |
| Support GO | „Km się nie liczą” — pobranie GPX + lokalny replay pipeline |

Runbooki: [operations/SIMULATOR.md](../operations/SIMULATOR.md) · [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md).

#### Faza 5 — RODO bulk export (CONSTITUTION)

| Element | Spec |
|---------|------|
| Endpoint | `GET /api/users/me/export/` (async) |
| Format | ZIP: JSON profilu + **GPX per aktywność** |
| Task | `export_user_data_task` — link ważny 24 h |
| SSOT | [CONSTITUTION.md](../CONSTITUTION.md) §8.3 — prawo do przenoszenia |
| Compliance | [compliance/RCP.md](../compliance/RCP.md) |

**Uwaga:** Faza 5 może startować równolegle z Fazą 1 (ten sam generator GPX), ale pełny ZIP wymaga stabilnego kontraktu eksportu.

### 2.3 Poza zakresem P2 (osobny tor)

| Temat | Uzasadnienie |
|-------|--------------|
| Upload GPX jako warunek finish | Duplikacja względem `route_path`; import Strava/Garmin = osobny produkt |
| GPX co tick (surowa telemetria) | Retencja surowych punktów — [CONSTITUTION.md](../CONSTITUTION.md) §8.2 (90 dni anonimizacja) |
| Import GPX → nowa aktywność | Faza 3 w starej rozmowie produktowej — **nie** w tym P2 slice |

### 2.4 Architektura docelowa (skrót)

```text
Mobile/Sim → GPS/punkty → route_path → finalize → verify (BRouter)
                                    ↓
                         Faza 1: GET …/gpx/ (on-demand)
                                    ↓
                         Faza 2: generate_gpx_task → S3/R2 + gpx_sha256
                                    ↓
              Faza 3–4: reverify · fingerprint · forensics · golden CI
                                    ↓
                         Faza 5: export_user_data_task → ZIP (RODO)
```

---

## 3. Auth / MFA (ex-P1 Paczka 6)

Szczegóły implementacji Auth przeniesione z [P1_ROADMAP.md §4](./P1_ROADMAP.md#4-paczki-36-skrót) — realizacja w torze P2 **po** paczkach produktowych P1 (5–6 w kolejności P1, lub równolegle gdy zespół auth oddzielny).

| Kryterium | Opis |
|-----------|------|
| MFA / 2FA | TOTP (lub WebAuthn — decyzja przy kickoff); wymuszenie dla `GLOBAL_OWNER` |
| Wipe safety | Typed env phrase + MFA ack — zgodnie z [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) § Wipe |
| Impersonation audit | `POST /users/impersonate/<id>/` — tylko `GLOBAL_OWNER`; middleware audit; UI sandbox |
| Settings | Sekcja MFA w admin Settings — persist do API |
| Testy | `test_impersonation_requires_global_owner` + smoke MFA flow |

**Powiązane:** [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) § Wipe / Impersonation · [RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md).

---

## 4. Kolejność względem P1

```text
P1: 1a ✅ → 1b ✅ → 2 Sponsor → 3 GO tooling → 4 Tenant Admin → 5 Moderator → 6 Auth (skrót w P1)
P2: GPX F1–F2 (core) ──► F3 anty-cheat ──► F4 forensics ──► F5 RODO ZIP
         ↑ start po 1b                          ↑ overlap z Paczka 5
P2 Auth/MFA: po Paczka 4 lub równolegle (ryzyko security — priorytet dla GO)
```

---

## 5. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [P1_ROADMAP.md](./P1_ROADMAP.md) | Aktywna sekwencja paczek 1–6 |
| [CONSTITUTION.md](../CONSTITUTION.md) | GPX w eksporcie RODO; Celery dla przetwarzania GPX |
| [DATA_RESILIENCE.md](../DATA_RESILIENCE.md) | `route_path` vs telemetry — kontekst forensics |
| [operations/SIMULATOR.md](../operations/SIMULATOR.md) | Sim FSM, `simulated` tagging |
| [compliance/RCP.md](../compliance/RCP.md) | Rejestr czynności RODO |

---

## 6. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-03 | Utworzenie P2; GPX forensics (F1–F5) + Auth/MFA ex-Paczka 6; decyzja: GPX nie blokuje finish |
