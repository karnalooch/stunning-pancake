# Runbook — weekend szczytu kampanii (RSP-weekend)

| | |
|--|--|
| **Status** | Active |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Owner** | Platform Operator |
| **Audience** | Decydent JST, Platform Operator, Tenant admin |
| **lang** | pl |
| **translation** | [English](../../en/operations/RSP_WEEKEND_RUNBOOK.md) |
| **canonical_path** | docs/gtm/pl/operations/RSP_WEEKEND_RUNBOOK.md |
| **Runbooki techniczne** | [EVENT_BURST_50K.md](../../../pl/EVENT_BURST_50K.md) · [SCALE_TEST_300K.md](../../../pl/SCALE_TEST_300K.md) |

---

## O co chodzi?

**RSP-weekend** = pierwszy weekend masowego startu kampanii sezonowej (wzorzec: Rajd Świętokrzyski / Aktywne Miasta — maj–czerwiec). Tysiące użytkowników jednocześnie: otwierają appkę, dołączają do eventu, startują sesje GPS.

**Pytanie decydenta:** „Co się stanie, gdy 10k–50k osób wystartuje w sobotę rano?”

**Krótka odpowiedź:** Platforma ma **dwie warstwy ochrony** (global load guard + event burst), stagger joinów, kolejkowanie sesji i mapę LOD — zaprojektowane po analizie awarii konkurencji (~150k sesji AM) i testach skali własnej.

---

## Przed weekendem (T-7 do T-1)

| # | Akcja | Owner | Done |
|---|-------|-------|------|
| 1 | `GET /api/activities/admin/scale-preflight/?target_users=N` — sprawdź `estimated_disk_gb`, `live_pool_mode` | Platform Operator | [ ] |
| 2 | Uczestnicy ≥1000 → burst protection włącza się **automatycznie** (`EVENT_BURST_MODE=auto`) | System | auto |
| 3 | Potwierdź Postgres volume ≥10 GB (kampanie >50k) | Platform Operator | [ ] |
| 4 | Komunikat do tenanta: harmonogram pushów rozłożony (nie wszyscy o 8:00) | Tenant admin | [ ] |
| 5 | Moderatorzy: kolejka anti-cheat — przegląd false positive z tygodnia przed | Tenant | [ ] |
| 6 | DPIA i regulamin opublikowane | Tenant | [ ] |

---

## W trakcie weekendu (T-0)

### Warstwa 1 — Global load guard (zawsze włączona)

Chroni platformę **niezależnie od eventu** — viral spike, masowy start bez zaplanowanego eventu.

| Sygnał | Domyślny cap | Efekt przy przekroczeniu |
|--------|--------------|--------------------------|
| Joins / min | 8000 | 429 + Retry-After |
| Session starts / min | 5000 | 429 + Retry-After |
| Telemetry ingest / s | 20000 | 429 + Retry-After |
| Concurrent riders | 50000 | Ograniczenie równoległych sesji |

### Warstwa 2 — Event burst (per event)

| Scenariusz | Zachowanie |
|------------|------------|
| 50k otwarć appki | Join rate capped (~5k/min per event gdy burst aktywny) |
| 50k startów sesji | Stagger ~3k/min; nadmiar w kolejce z Retry-After |
| 50k równoległych GPS | Target `EVENT_MAX_CONCURRENT_RIDERS=50000`; mapa LOD (H3/meso) |

### Monitoring (Platform Operator)

| Metryka | Gdzie | Alarm jeśli |
|---------|-------|-------------|
| `routing_queue_depth` | Dashboard / live-simulate | Ciągły backpressure >15 min |
| `loadguard.engaged` | Logi Railway | Wszystkie sygnały engaged >5 min |
| Celery worker OOM | Railway logs | Restart loop |
| Map API p95 | Telemetry | >2 s viewport |
| Join 429 rate | API logs | >5% requestów |

### Komunikacja z uczestnikami

| Sytuacja | Kanał | Treść (szablon) |
|----------|-------|-----------------|
| Opóźniony start sesji (429) | In-app / push | „Duże obciążenie — spróbuj za 30 s. Twoja aktywność nie zostanie utracona.” |
| Planowana przerwa techniczna | Baner in-app + mail | `[DO WDROŻENIA iteracja 2 — baner BE]` |
| Incydent bezpieczeństwa | Mail + baner | Eskalacja do DPO tenanta |

**Cel:** uczestnik wie, że system **nie gubi GPS** (outbox mobile) nawet przy chwilowym 429.

---

## Eskalacja

| Poziom | Warunek | Akcja | Kontakt |
|--------|---------|-------|---------|
| L1 | Pojedyncze 429, backpressure <15 min | Monitor | Platform Operator on-call |
| L2 | Backpressure >15 min lub map p95 >3 s | Zwiększ cap tymczasowo / rozłóż pushy | Platform Operator + Tenant |
| L3 | OOM workerów, DB disk >90% | Pause live sim, scale workers, komunikat tenant | GLOBAL_OWNER |
| L4 | Utrata danych / breach | Incident RODO + DPO | Legal |

---

## Po weekendzie (T+1)

| Akcja | Owner |
|-------|-------|
| Raport: peak joins, 429 count, max concurrent riders | Platform Operator |
| Retrospektywa z tenantem (30 min) | Customer Success |
| Uzupełnij [SCALE_PROOF_ONE_PAGER.md](./SCALE_PROOF_ONE_PAGER.md) jeśli był kontrolowany load test | Platform Operator |
| Aktualizacja runbooka jeśli nowe ustalenia | Docs |

---

## Werdykt dla decydenta (jedno zdanie)

**Przy RSP-weekend platforma degraduje gracefully** (kolejki, 429, stagger) zamiast padać — w przeciwieństwie do udokumentowanych awarii konkurencji przy podobnej skali.

---

*Szczegóły techniczne: [EVENT_BURST_50K.md](../../../pl/EVENT_BURST_50K.md) · [SIMULATOR.md](../../../pl/operations/SIMULATOR.md)*
