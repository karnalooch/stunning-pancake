# P1 — Roadmap panelu admin (decyzje 2026-06-03)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-10 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/admin/P1_ROADMAP.md) |
| **canonical_path** | docs/admin/P1_ROADMAP.md |

---

| | |
|--|--|
| **Status** | ✅ **P1 code complete** — prod sign-off: P0 smoke + operational gate (credentials) |
| **Główny użytkownik** | `GLOBAL_OWNER` |
| **Post-deploy gate** | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) · `pnpm gate:p1-closure` |
| **Operacje Railway** | [RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1` |
| **Audyt UI (snapshot)** | [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) |

---

## 1. Decyzje z Q&A (skrót)

| Temat | Decyzja |
|-------|---------|
| Zakres P1 | Wszystkie obszary P1 **sekwencyjnie** (paczki 1→6) |
| Użytkownik startowy | **GLOBAL_OWNER** (codzienny simulator) |
| Simulator | **Paczka 1** — pierwsza, codzienne użycie |
| Sponsor | **Paczka 2** — code ✅ |
| Tenant Admin | **Paczka 4** — code ✅ |
| Auth / 2FA | **[P2_ROADMAP.md](./P2_ROADMAP.md)** § Auth (było Paczka 6) |
| GPX / forensics | **[P2_ROADMAP.md](./P2_ROADMAP.md)** §2 GPX (F1–F6 + checklista §2.3) |
| Moderatorzy | **Paczka 5** — code ✅ |
| RAM / Railway | **10D** — SSOT [RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md) |
| Deploy | **11C** — brak stagingu → §4 |
| Tryb pracy | Dokument + wdrożenie od razu |

### Kolejność paczek (8A) — status

| # | Paczka | Status |
|---|--------|--------|
| 1 | Simulator + skala (1a + 1b core) | ✅ code · 🟡 prod gate |
| 2 | Sponsor portal | ✅ code · 🟡 prod gate |
| 3 | GO tooling (health strip, drill-down) | ✅ |
| 4 | Tenant Admin scoped IA | ✅ |
| 5 | Moderator unified inbox + anti-cheat | ✅ |
| 6 | Auth / MFA | → [P2_ROADMAP.md](./P2_ROADMAP.md) |

---

## 2. Paczka 1 — Simulator + skala

### Paczka 1a ✅

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

### Paczka 1b ✅ (core) · operational gate 🟡 prod

| Element | Status |
|---------|--------|
| Backpressure kolejki `routing` | ✅ |
| Dashboard KPI „sim ON” | ✅ |
| Simulator page — queue KPI | ✅ |
| Live Map + FSM | ✅ |
| Load-test 10k | ✅ szablon lokalny; prod 50k odroczony |
| Metryki Datadog | ✅ |
| Testy pytest `-m simulator_light` | ✅ CI |
| Operational gate tooling | ✅ `run-simulator-operational-gate.ps1`, `simulator_operational_gate.py` |

#### Operational closure (prod — wymaga credentiali)

| # | Kryterium | Status |
|---|-----------|--------|
| 1 | `python run_pytest.py … -m simulator_light` — CI | ✅ |
| 2 | `.\scripts\railway-verify-production.ps1` | ✅ historycznie · uruchom po deploy |
| 3 | P0 smoke GO — [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) | 🟡 `pnpm gate:p0-smoke` + podpis GO |
| 4 | Live sim: `routing_queue_depth` stabilne | 🟡 `pnpm gate:simulator` (17 min) po `railway-sync-sim-env.ps1` |
| 5 | Load-test 10k szablon | ✅ |
| 6 | Brak lawiny `sim.routing.backpressure` | 🟡 ten sam gate script |

**Automatyzacja lokalna (bez prod):** `pnpm gate:p1-closure`

**Automatyzacja prod:** `pnpm gate:p1-closure` nie uruchamia prod — użyj:

```powershell
.\scripts\run-p1-closure.ps1 -RailwayVerify -P0Smoke -SimulatorGate -SyncSimEnvFirst
```

---

## 3. Paczka 2 — Sponsor ✅ code

| Kryterium | Status |
|-----------|--------|
| Nav: Sponsor Dashboard, POI, Vouchers, Analytics | ✅ |
| Puste stany z CTA | ✅ `SponsorEmptyCta` |
| API sponsor scope | ✅ |
| `POST /rewards/pools/` | ✅ + `rewards/test_pools.py` CI |

---

## 4. Paczka 3 — GO tooling ✅

| Kryterium | Status |
|-----------|--------|
| `goHealth.ts` — GO/WARN/NO-GO | ✅ + testy |
| `GoHealthStrip` na Dashboard | ✅ klikalne mod queue / simulator |
| `DataSourceBanner` — prod vs sim-lab KPI | ✅ |
| `tenantDrillDown` + menu w tabeli tenantów | ✅ Users / Activities / Live Map |
| `tenant_id` filter na activities admin (global owner) | ✅ |

---

## 5. Paczka 4 — Tenant Admin ✅

| Kryterium | Status |
|-----------|--------|
| `useTenantScope` + `TenantScopeBanner` | ✅ Dashboard, Users, Activities, Departments |
| `TenantAdminQuickActions` | ✅ |
| `TenantFilterBanner` drill-down | ✅ |
| Backend tenant scoping (stats, activities, tenants list) | ✅ |
| Department moderator assign UI | ✅ form `moderator` field |
| CityAnalytics — real weekly charts z API | ✅ `weekly_activity_breakdown` |

---

## 6. Paczka 5 — Moderator queue ✅

| Kryterium | Status |
|-----------|--------|
| Unified inbox `/owner/moderation` | ✅ |
| Anti-cheat tab (severity, dedupe, approve/reject) | ✅ |
| Pending activities tab + GPX | ✅ |
| Events tab — draft publish | ✅ PATCH `status=PUBLISHED` |
| Anti-Cheat page depth | ✅ tabela + map + actions |
| Backend anomaly queue (`score < 0.3`) | ✅ `test_anomaly_queue.py` CI |
| `ModeratorWorklist` tenant scope | ✅ |

---

## 7. Paczka 6 — Auth → P2

Pełny scope: [P2_ROADMAP.md](./P2_ROADMAP.md) § Auth/MFA (MFA, impersonation audit).

---

## 8. Odłożone do P2

| Temat | Dokument |
|-------|----------|
| GPX: on-demand, S3, forensics, RODO ZIP | [P2_ROADMAP.md](./P2_ROADMAP.md) §2 |

---

## 9. RAM 10D — skrót

Pełna tabela: [operations/RAILWAY_CELERY_MEMORY.md](../operations/RAILWAY_CELERY_MEMORY.md).

| Serwis | RAM |
|--------|-----|
| `celery-worker-simulation` | **≥ 2 GB** |
| `celery-worker-routing` | **≥ 1 GB** |
| Backend API | ≥ 1 GB |
| BRouter | ≥ 512 MB |

---

## 10. Deploy bez stagingu (11C)

| Ryzyko | Mitigacja |
|--------|-----------|
| Regresja live sim | niski `active_ratio` przed skalą |
| OOM worker | verify script + RAM SSOT |
| RBAC / Wipe | P0 smoke; wipe planowany |

**Obowiązkowe po deploy:** `pnpm gate:p1-closure` (lokalnie) → prod gates → podpis GO w checklist.

---

## 11. Linki operacyjne

| Dokument | Opis |
|----------|------|
| [operations/SIMULATOR.md](../operations/SIMULATOR.md) | Runbook batch → live |
| [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) | Checklist + skrypt |
| [operations/OPERATIONS_INDEX.md](../operations/OPERATIONS_INDEX.md) | Macierz runbooków |
| [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) | Release gate |

---

## 12. Historia

| Data | Zmiana |
|------|--------|
| 2026-06-10 | **P1 code closure:** paczki 2–5 domknięte w kodzie; `weekly_activity_breakdown`; Anti-Cheat depth; Events publish; `gate:p1-closure`; CI `test_anomaly_queue` + `test_pools` |
| 2026-06-04 | Operational closure Railway 8GB; telemetry sharding Phase 2 |
| 2026-06-03 | Paczka 1b enterprise; operational gate checklist |
| 2026-06-03 | Utworzenie dokumentu |
