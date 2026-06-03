# P1 — Roadmap panelu admin (decyzje 2026-06-03)

| | |
|--|--|
| **Status** | ✅ Active — Paczka **1a** wdrożona; **1b** i Paczka **2** następne |
| **Główny użytkownik** | `GLOBAL_OWNER` |
| **Post-deploy gate** | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |
| **Operacje Railway** | [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1` |
| **Audyt UI (snapshot)** | [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) |

---

## 1. Decyzje z Q&A (skrót)

| Temat | Decyzja |
|-------|---------|
| Zakres P1 | Wszystkie obszary P1 **sekwencyjnie** (paczki 1→6) |
| Użytkownik startowy | **GLOBAL_OWNER** (codzienny simulator) |
| Simulator | **Paczka 1** — pierwsza, codzienne użycie |
| Sponsor | **Paczka 2** — **następna** (po domknięciu 1b operacyjnie) |
| Tenant Admin | **Paczka 4** — za ~1 tydzień |
| Auth / 2FA | **P2** (Paczka 6) |
| Moderatorzy | **Paczka 5** |
| RAM / Railway | **10D** — SSOT [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) |
| Deploy | **11C** — brak stagingu → §4 |
| Tryb pracy | Dokument + wdrożenie od razu |

### Kolejność paczek (8A)

1. **Simulator + skala** — 1a ✅ · 1b 🚧  
2. **Sponsor** (Paczka 2) — **teraz (product)**  
3. **GO tooling** (Paczka 3)  
4. **Tenant Admin** (Paczka 4)  
5. **Moderator queue** (Paczka 5)  
6. **Auth P2** (Paczka 6)

---

## 2. Paczka 1 — Simulator + skala

### Paczka 1a ✅ (wdrożone 2026-06-03)

| Element | Status |
|---------|--------|
| FSM jazdy w Redis (`PENDING_ROUTE` … `FAILED_UNROUTABLE`) | ✅ |
| Kolejka Celery `routing` + `route_live_ride_task` | ✅ |
| Live tick — tylko `ACTIVE`; starty → `PENDING_ROUTE` + dispatch | ✅ |
| API: `ride_warming`, `ride_routing`, `async_routing_enabled`, … | ✅ |
| UI Simulator — badge Warming / Routing / Queued | ✅ |
| Logi: throttle island; `sim.routing.unroutable` / `sim.routing.error` | ✅ |
| Railway: dokumentacja + worker `celery-worker-routing` | ✅ |
| Testy: FSM + routing queue + status API | ✅ |

**Weryfikacja prod (Platform Operator):**

1. `.\scripts\railway-verify-production.ps1` → PASS  
2. Logi `celery-worker-routing`: `routing@`, brak Expo  
3. Live sim: `ride_warming` → spadek po rozgrzaniu tras  

Szczegóły env/RAM: [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md).

### Paczka 1b 🚧 (następny slice — backend/ops)

| Element | Kryterium akceptacji |
|---------|----------------------|
| Backpressure kolejki `routing` | Limit dispatch / metryki głębokości kolejki |
| Dashboard KPI „sim ON” | Widoczność na prod bez mylenia z KPI athlete |
| Live Map + FSM | Pełna spójność warstw mapy ze stanami Redis |
| Load-test 10k | Osobny worker routing, raport w [SCALE_TEST_300K.md](../SCALE_TEST_300K.md) / SIMULATOR |
| Metryki | Datadog (opcjonalnie) — `sim.routing.*` |

---

## 3. Paczka 2 — Sponsor (portal partnera) — **NEXT product**

**Cel:** `SPONSOR` widzi Vouchers + Analytics; sensowne empty state.

| Kryterium |
|-----------|
| Nav: Sponsor Dashboard, POI, Vouchers, Analytics dla `SPONSOR` |
| Puste stany z CTA „Create first voucher” / link POI |
| API sponsor scope — tylko własny tenant |

**Gate przed startem:** P0 smoke GO dla ról dotkniętych nav ([P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md)).

---

## 4. Paczki 3–6 (skrót)

Szczegóły bez zmian merytorycznych — patrz poprzednia wersja dokumentu:

- **Paczka 3** — health strip GO, drill-down tenant  
- **Paczka 4** — `TENANT_ADMIN` scoped IA  
- **Paczka 5** — unified moderator inbox; fix `ModeratorWorklist` tenantId  
- **Paczka 6** — MFA, impersonation audit  

---

## 5. RAM 10D — rekomendacje (skrót)

Pełna tabela: [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md).

| Serwis | RAM | Uwagi |
|--------|-----|--------|
| `celery-worker-simulation` | **≥ 2 GB** | `solo`; nie prefork 6–7 @ 512 MB |
| `celery-worker-routing` | **≥ 1 GB** | Tylko BRouter HTTP |
| Backend API | ≥ 1 GB | Status poll + heal |
| BRouter | ≥ 512 MB | `*.railway.internal` |

---

## 6. Deploy bez stagingu (11C)

| Ryzyko | Mitigacja (rola) |
|--------|------------------|
| Regresja live sim | Platform Operator: niski `active_ratio` przed 10k |
| OOM worker | [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) + verify script |
| RBAC / Wipe | Release Manager: P0 smoke; wipe tylko planowany |

**Obowiązkowe:** feature flags `SCALE_SIM_ASYNC_ROUTING`; P0 smoke; reset locks po SIGKILL; rollback obrazu Railway.

---

## 7. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [operations/SIMULATOR.md](../operations/SIMULATOR.md) | Runbook batch → live |
| [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + skrypt |
| [operations/OPERATIONS_INDEX.md](../operations/OPERATIONS_INDEX.md) | Macierz runbooków |
| [operations/BROUTER.md](../operations/BROUTER.md) | BRouter |
| [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) | Release gate |

---

## 8. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-03 | Paczka 1a done; linki verify script; 1b + Paczka 2 next |
| 2026-06-03 | Utworzenie dokumentu; FSM + routing queue + API/UI |
