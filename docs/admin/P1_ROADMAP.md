# P1 — Roadmap panelu admin (decyzje 2026-06-03)

> **Status:** Paczka 1 (Simulator + skala) — wdrożona pierwsza iteracja  
> **Główny użytkownik teraz:** `GLOBAL_OWNER`  
> **Powiązane:** [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) · [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) · [operations/SIMULATOR.md](../operations/SIMULATOR.md)

---

## 1. Decyzje z Q&A (skrót)

| Temat | Decyzja |
|-------|---------|
| Zakres P1 | Wszystkie obszary P1 **sekwencyjnie** (paczki 1→6) |
| Użytkownik startowy | **GLOBAL_OWNER** (codzienny simulator) |
| Simulator | **Paczka 1** — pierwsza, codzienne użycie |
| Sponsor | **Paczka 2** — zaraz po simulatorze (**teraz**) |
| Tenant Admin | **Paczka 4** — za ~1 tydzień |
| Auth / 2FA | **P2** (brak presji sprzedażowej) |
| Moderatorzy | **Paczka 5** — kolejka codziennie; możliwa repriorytetyzacja (9A) |
| RAM / Railway | **10D** — dokumentacja rekomendacji ([RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md)) |
| Deploy | **11C** — docelowo staging→prod, ale **brak stagingu** → patrz §6 |
| Tryb pracy | **Dokument + wdrożenie od razu** (nie tylko spec) |

### Kolejność paczek (8A)

1. **Simulator + skala** (Paczka 1)  
2. **Sponsor** (Paczka 2)  
3. **GO tooling** — control plane, tenant drill-down (Paczka 3)  
4. **Tenant Admin** — scoped IA (Paczka 4)  
5. **Moderator queue** — unified inbox (Paczka 5)  
6. **Auth P2** — MFA, session hardening (Paczka 6)

---

## 2. Paczki — cele i kryteria akceptacji

### Paczka 1 — Simulator + skala ✅ (iteracja 1)

**Cel:** Oddzielić drogi BRouter od `live_tick`, ograniczyć OOM i spam logów; widoczność „warming/routing” w API i UI.

| Element | Kryterium akceptacji |
|---------|----------------------|
| FSM jazdy w Redis | Stany: `PENDING_ROUTE`, `ROUTING`, `ROUTED`, `ACTIVE`, `FAILED_UNROUTABLE` |
| Kolejka Celery `routing` | `route_live_ride_task` — generacja trasy poza tickiem |
| Live tick | Kończy tylko `ACTIVE`; telemetria tylko `ACTIVE`; starty → `PENDING_ROUTE` + dispatch |
| API live status | `ride_warming`, `ride_routing`, `ride_routed`, `async_routing_enabled`, liczniki unroutable |
| UI Simulator | Badge Warming / Routing / Queued przy live RUNNING |
| Logi / metryki | Throttle „island/unroutable”; structured `sim.routing.unroutable` / `sim.routing.error` |
| Railway | Dokumentacja drugiego workera `routing` lub `simulation,routing` |
| Testy | FSM + routing queue + status API |

**Wdrożone w paczce 1a (ten release):** powyższe rdzenie.  
**Paczka 1b (kolejny slice):** backpressure routing queue, dashboard KPI „sim ON”, pełna integracja Live Map z FSM, load-test 10k z osobnym workerem routing, metryki Datadog.

---

### Paczka 2 — Sponsor (portal partnera)

**Cel:** `SPONSOR` widzi Vouchers + Analytics w nawigacji; KPI niezerowe lub sensowne empty state z CTA.

| Kryterium |
|-----------|
| Nav: Sponsor Dashboard, POI, Vouchers, Analytics dla roli `SPONSOR` |
| Puste stany z przyciskiem „Create first voucher” / link do POI |
| API sponsor scope — tylko własny tenant |

---

### Paczka 3 — GLOBAL_OWNER tooling

**Cel:** Pasek zdrowia platformy + drill-down tenant.

| Kryterium |
|-----------|
| Health strip: API latency, głębokość kolejki mod, flaga simulator |
| Klik wiersza tenant → filtr Users / Activities / bbox mapy |
| Simulator wyłączony z KPI produkcyjnych na prod |

---

### Paczka 4 — Tenant Admin (~1 tydzień)

**Cel:** Domyślny filtr `tenant_id`; dashboard bez globalnych 10k.

| Kryterium |
|-----------|
| `TENANT_ADMIN` widzi tylko swój tenant na listach |
| Dashboard tenant-scoped (nie global overview) |
| Brak przycisków GO-only (Wipe, global RBAC edit) |

---

### Paczka 5 — Moderator queue

**Cel:** Jedna kolejka: pending activities + anomalies + events.

| Kryterium |
|-----------|
| Unified inbox z sortowaniem i assignee |
| Fix `ModeratorWorklist`: `user.tenantId`, nie `per_tenant[0]` |
| Bulk approve z jednego ekranu |

*Uwaga 9A:* jeśli moderatorzy codziennie blokują release — można podnieść paczkę 5 przed 3/4.

---

### Paczka 6 — Auth P2

**Cel:** MFA, sesje support, bez presji na sprzedaż.

| Kryterium |
|-----------|
| TOTP / backup codes dla adminów |
| Impersonation: banner + timeout + audit |
| Wipe: opcjonalne MFA (już częściowo w UI — dokończyć backend) |

---

## 3. RAM 10D — rekomendacje (skrót)

Pełna tabela: [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md).

| Serwis | RAM | Uwagi |
|--------|-----|--------|
| `celery-worker-simulation` | **≥ 2 GB** | `solo` lub prefork=2; nie 6–7 przy 512 MB |
| `celery-worker-routing` (opcjonalny) | **≥ 1 GB** | Tylko BRouter HTTP; `CELERY_WORKER_QUEUES=routing` |
| Backend API | ≥ 1 GB | Status poll + heal |
| BRouter | ≥ 512 MB | Internal Railway DNS |

Zmienne kluczowe: `SCALE_MAX_STARTS_PER_LIVE_TICK`, `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK`, `SCALE_SIM_ASYNC_ROUTING=1`.

---

## 4. Deploy bez stagingu (11C — alternatywa)

**Decyzja użytkownika:** brak osobnego środowiska staging na Railway.

### Ryzyka

| Ryzyko | Skutek |
|--------|--------|
| Regresja live sim / mapy | Widoczna na prod dla GO |
| OOM workera | Przerwa w tickach, stuck locks |
| Zmiana RBAC / Wipe | Nieodwracalne na prod DB |

### Mitigacje (obowiązkowe przy braku staging)

1. **Feature flags** — `SCALE_SIM_ASYNC_ROUTING`, `SCALE_SIM_SKIP_BROUTER` per service; wyłączenie bez redeploy całego backendu (tylko worker env).  
2. **Prod smoke po deploy** — [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) jako GO gate; live sim na niskim `active_ratio` przed 10k.  
3. **Reset locks** — `POST /api/activities/admin/simulator-reset/` po incydencie worker SIGKILL.  
4. **Dokumentowany rollback** — poprzedni obraz Railway / revert commit na `main`.  
5. **Rekomendacja na później** — osobny projekt Railway „staging” (kopia env bez prod DB); nie blokuje P1.

---

## 5. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [operations/SIMULATOR.md](../operations/SIMULATOR.md) | Runbook batch → live, FSM, routing worker |
| [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) | OOM, kolejki, RAM |
| [operations/BROUTER.md](../operations/BROUTER.md) | BRouter, pass=0 / island |
| [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) | Release gate |

---

## 6. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-03 | Utworzenie dokumentu; Paczka 1a: FSM + routing queue + API/UI |
