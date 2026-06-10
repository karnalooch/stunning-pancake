# Admin panel — indeks dokumentacji

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../admin/ADMIN_INDEX.md) |
| **canonical_path** | docs/pl/admin/ADMIN_INDEX.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Admin / Frontend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Admin developers, Release Manager, GLOBAL_OWNER testers |
| **Standard** | [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md) |
| **Główny hub** | [README.md](./README.md) |

---

## Cel

Jedna macierz dokumentów panelu admin: co czytać przed release, kto utrzymuje, jak łączy się z operacjami Railway i smoke testami.

---

## Macierz dokumentów

| Dokument | Cel (skrót) | Status | Kadencja |
|----------|-------------|--------|----------|
| [ADMIN_ROADMAP.md](./ADMIN_ROADMAP.md) | **SSOT** — zunifikowana oś czasu P0→P1→P2→V3 | ✅ Active | Po każdej paczce / gate |
| [README.md](./README.md) | Design system, moduły, dev, nawigacja RBAC | ✅ Active | Po większej zmianie UI |
| [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) | Post-deploy GO/NO-GO per rola | ✅ Active | **Każdy** deploy admin |
| [P1_ROADMAP.md](./P1_ROADMAP.md) | Paczki 1–6; **1a ✅**, 1b + Paczka 2 | ✅ Active | Co sprint / po paczce |
| [P2_ROADMAP.md](./P2_ROADMAP.md) | GPX backlog (F1–F6, checklista §2.3), Auth/MFA ex-Paczka 6 | ✅ Active | Przy kickoff P2 |
| [ROADMAP_V3.md](./ROADMAP_V3.md) | Spec v3 (mapa, paginacja, AI coach) | ✅ Active | Przy kickoff v3 |
| [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md) | Snapshot audytu tras i luk | 📦 Snapshot | Nie nadpisywać — nowy plik `UI_AUDIT_*` |
| [WEBGL_LIVE_MAP_AUDIT_2026-06-06.md](../../admin/WEBGL_LIVE_MAP_AUDIT_2026-06-06.md) | Audyt WebGL Live Map (prod) + JSON | 📦 Snapshot | Po ponownym audycie — nowy plik datowany |

---

## Wizje doświadczenia (overhaul_plan)

North Star per rola — **co i dlaczego**. Oś czasu: [ADMIN_ROADMAP.md](./ADMIN_ROADMAP.md). Szczegóły techniczne: [P1_ROADMAP](./P1_ROADMAP.md).

| Dokument wizji | Rola | Etap ADMIN_ROADMAP |
|----------------|------|---------------------|
| [SPONSOR_EXPERIENCE_OVERHAUL](../../overhaul_plan/SPONSOR_EXPERIENCE_OVERHAUL.md) | SPONSOR | S1 |
| [GLOBAL_OWNER_EXPERIENCE_OVERHAUL](../../overhaul_plan/GLOBAL_OWNER_EXPERIENCE_OVERHAUL.md) | GLOBAL_OWNER | S2 |
| [TENANT_ADMIN_EXPERIENCE_OVERHAUL](../../overhaul_plan/TENANT_ADMIN_EXPERIENCE_OVERHAUL.md) | TENANT_ADMIN | S3 |
| [MODERATOR_PANEL_OVERHAUL](../../overhaul_plan/MODERATOR_PANEL_OVERHAUL.md) | TENANT_MODERATOR | S4 |
| [USER_PANEL_VISION](../../overhaul_plan/USER_PANEL_VISION.md) | ATHLETE (mobile) | S6 |

Indeks: [overhaul_plan/README.md](../../overhaul_plan/README.md).

---

## Ścieżka release (kolejność)

| Krok | Rola | Dokument / artefakt |
|------|------|-------------------|
| 1 | Release Manager | [operations/PRE_RELEASE_VERIFICATION.md](../../operations/PRE_RELEASE_VERIFICATION.md) |
| 2 | GLOBAL_OWNER / QA | [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) → **GO** wymagane przed P1 |
| 3 | Platform Operator | Jeśli symulator na prod: [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../../operations/RAILWAY_PRODUCTION_CHECKLIST.md) + `scripts/railway-verify-production.ps1` |
| 4 | Admin Lead | [P1_ROADMAP.md](./P1_ROADMAP.md) — kolejna paczka produktowa |
| 4b | Admin / Backend Lead | [P2_ROADMAP.md](./P2_ROADMAP.md) — GPX / Auth (po 1b) |
| 5 | Release Manager | [compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) (release publiczny) |

---

## Powiązane (SSOT poza admin)

| Temat | Dokument |
|-------|----------|
| Live Map / symulator (ops) | [operations/SIMULATOR.md](../../operations/SIMULATOR.md) |
| API admin simulator | [API.md](../API.md) |
| RBAC w kodzie | [RBAC.md](../../RBAC.md) |
| Niezawodność / locki | [reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) |
| Railway OOM / caps | [operations/RAILWAY_CELERY_MEMORY.md](../../operations/RAILWAY_CELERY_MEMORY.md) |

---

## Weryfikacja (po deploy)

1. Uruchom checklistę P0 dla docelowego URL admin (wszystkie role z sekcji).
2. Przy użyciu symulatora: logi Celery — [RAILWAY_PRODUCTION_CHECKLIST.md](../../operations/RAILWAY_PRODUCTION_CHECKLIST.md) § Po deploy.
3. Zapisz sign-off w tabeli na końcu [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md).

---

## Troubleshooting (skrót)

| Objaw | Akcja |
|-------|--------|
| P0 NO-GO po deploy | Zatrzymaj P1; issue w trackerze; rollback Railway deployment admin |
| Simulator stuck / 409 | [RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md) |
| OOM workerów | [RAILWAY_CELERY_MEMORY.md](../../operations/RAILWAY_CELERY_MEMORY.md) — nie duplikuj caps w admin docs |
