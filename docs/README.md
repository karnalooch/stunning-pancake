# 4VELO — dokumentacja (indeks główny)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead / Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Standard treści** | [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) |
| **Utrzymanie** | [MAINTENANCE.md](./MAINTENANCE.md) |

---

## Cel tego indeksu

Jeden punkt wejścia do całego drzewa `docs/`: architektura, operacje produkcyjne (Railway), panel admin, zgodność, onboarding i archiwum snapshotów.

**Audience:** Deweloperzy, operatorzy platformy, release managerzy, audyt compliance.

---

## Polityka językowa (EN + PL)

Model **enterprise**: zwierciadlane drzewa `docs/en/` i `docs/pl/`, metadane `lang` + `translation`, rejestr migracji i CI — bez duplikowania tabel env między językami (link do SSOT).

| Obszar | PL | EN | Uwagi |
|--------|----|----|--------|
| Runbooki `operations/`, `runbooks/` | Kanoniczny (legacy ścieżka) | `docs/en/operations/…` | Pilotaż: [LIVE_MAP](./operations/LIVE_MAP.md) ↔ [EN](./en/operations/LIVE_MAP.md) |
| ADR, `API.md`, architektura | Opcjonalne streszczenie | **Kanoniczny** | Brak pełnej kopii ADR po PL |
| `admin/` checklisty | Na żądanie | **Kanoniczny** | |
| `compliance/RELEASE_*` | — | **Kanoniczny** | |
| `product/`, `onboarding/` | Kanoniczny | W migracji | |

| Dokument | Opis |
|----------|------|
| [locales/README.md](./locales/README.md) | Hub dwujęzyczny |
| [locales/MIGRATION_REGISTRY.md](./locales/MIGRATION_REGISTRY.md) | Co już sparowane, co `pending` |
| [locales/STANDARD.pl.md](./locales/STANDARD.pl.md) | Standard autora (PL) |

Szczegóły: [DOCUMENTATION_STANDARDS.md § Język](./DOCUMENTATION_STANDARDS.md#język-en--pl--enterprise).

---

## Contributing i utrzymanie

| Dokument | Opis |
|----------|------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR, testy, kiedy aktualizować docs |
| [quality/README.md](./quality/README.md) | Program jakości kodu (cały monorepo, fazy 0–5) |
| [SECURITY.md](../SECURITY.md) | Zgłaszanie luk, wersje wspierane, zależności |
| [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) | Szablon sekcji, SSOT, bezpieczeństwo |
| [MAINTENANCE.md](./MAINTENANCE.md) | Inwentarz świeżości, checklista po release |
| CI link check | `.github/workflows/docs.yml` · `scripts/check_docs_links.py` |

---

## Pełne drzewo `docs/` (68+ plików .md)

### Korzeń `docs/`

| Plik | Status | Opis |
|------|--------|------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | ✅ Active | Szybki start ~15 min |
| [INSTALLATION.md](./INSTALLATION.md) | ✅ Active | Docker Compose, porty |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | ✅ Active | Struktura repo, testy |
| [CONFIGURATION.md](./CONFIGURATION.md) | ✅ Active | Django, Redis, `SCALE_*` (linki SSOT) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | ✅ Active | Wdrożenie, SSL, Railway |
| [UPDATES.md](./UPDATES.md) | ✅ Active | Proces aktualizacji zależności |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | ✅ Active | Backend, mobile, anti-cheat, PostGIS |
| [DEPARTMENT_ARCHITECTURE.md](./DEPARTMENT_ARCHITECTURE.md) | ✅ Active | Działy / tenant |
| [diagrams/architecture_c4.md](./diagrams/architecture_c4.md) | ✅ Active | Diagramy C4 (Mermaid) |
| [API.md](./API.md) | ✅ Active | REST, auth, admin simulator |
| [RBAC.md](./RBAC.md) | ✅ Active | Role i uprawnienia |
| [CONSTITUTION.md](./CONSTITUTION.md) | ✅ Active | Zasady projektu (żywy dokument) |
| [MIGRATION.md](./MIGRATION.md) | ✅ Active | Migracje DB / danych |
| [DATA_RESILIENCE.md](./DATA_RESILIENCE.md) | ✅ Active | GPS buffer, outbox (mobile) |
| [SIMULATOR_ARCHITECTURE.md](./SIMULATOR_ARCHITECTURE.md) | ✅ Active | Spec Redis + Celery (implementacja) |
| [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) | ✅ Active | Worker `simulation` (SSOT env) |
| [DISK_GUARD.md](./DISK_GUARD.md) | ✅ Active | Budżet Postgres |
| [SCALE_TEST_300K.md](./SCALE_TEST_300K.md) | ✅ Active | Test obciążeniowy 300k |
| [EVENT_BURST_50K.md](./EVENT_BURST_50K.md) | ✅ Active | Burst przy dniu eventu |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | ✅ Active | CORS, DB, Celery, symulator |

### `docs/operations/` — [README](./operations/README.md) · [OPERATIONS_INDEX](./operations/OPERATIONS_INDEX.md)

| Plik | Status | Opis |
|------|--------|------|
| [RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) | ✅ Active | Checklist prod + `railway-verify-production.ps1` |
| [RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) | ✅ Active | SSOT: OOM, caps `SCALE_*`, RAM |
| [RAILWAY_KUBERNETES.md](./operations/RAILWAY_KUBERNETES.md) | ✅ Active | Railway ≠ K8s |
| [KUBERNETES.md](./operations/KUBERNETES.md) | ✅ Active | Manifesty `infrastructure/k8s/` |
| [SIMULATOR.md](./operations/SIMULATOR.md) | ✅ Active | Batch → live, FSM, admin map |
| [BROUTER.md](./operations/BROUTER.md) | ✅ Active | BRouter, kafelki, routing |
| [MOBILE.md](./operations/MOBILE.md) | ✅ Active | EAS build/release, GPS recovery |
| [PRE_RELEASE_VERIFICATION.md](./operations/PRE_RELEASE_VERIFICATION.md) | ✅ Active | Gate przed release |

### `docs/admin/` — [README](./admin/README.md) · [ADMIN_INDEX](./admin/ADMIN_INDEX.md)

| Plik | Status | Opis |
|------|--------|------|
| [P0_SMOKE_CHECKLIST.md](./admin/P0_SMOKE_CHECKLIST.md) | ✅ Active | Post-deploy smoke (**P0 DONE**) |
| [P1_ROADMAP.md](./admin/P1_ROADMAP.md) | ✅ Active | Paczki 1–6; **1a done**, 1b + Paczka 2 |
| [P2_ROADMAP.md](./admin/P2_ROADMAP.md) | ✅ Active | GPX backlog (F1–F6, §2.3), Auth/MFA (post-P1) |
| [ROADMAP_V3.md](./admin/ROADMAP_V3.md) | ✅ Active | Spec v3 |
| [UI_AUDIT_2026-06-02.md](./admin/UI_AUDIT_2026-06-02.md) | 📦 Snapshot | Audyt UI; P0 zamknięte |

### `docs/compliance/` — [README](./compliance/README.md) · [COMPLIANCE_INDEX](./compliance/COMPLIANCE_INDEX.md)

| Plik | Opis |
|------|------|
| [RCP.md](./compliance/RCP.md) | RODO — rejestr czynności |
| [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](./compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | Gate release OSS/GDPR/ToS |
| [MAP_BASEMAP_LICENSING.md](./compliance/MAP_BASEMAP_LICENSING.md) | Licencje map bazowych |

### `docs/adr/` (001–011)

| ADR | Temat |
|-----|--------|
| [001](./adr/001-react-native-bridgeless.md) | React Native bridgeless |
| [002](./adr/002-unistyles-v3-initialization.md) | Unistyles v3 |
| [003](./adr/003-state-management-legend-state.md) | Legend State |
| [004](./adr/004-persistent-storage-mmkv.md) | MMKV |
| [005](./adr/005-telemetry-tracking.md) | Telemetria |
| [006](./adr/006-design-system-stitch.md) | Design system |
| [007](./adr/007-ai-coaching-architecture.md) | AI coaching |
| [008](./adr/008-backend-strategy.md) | Backend strategy |
| [009](./adr/009-admin-user-management-and-event-matchmaking.md) | Admin users / events |
| [010](./adr/010-simulator-redis-celery.md) | Simulator Redis/Celery |
| [011](./adr/011-telemetry-ingest-durability-under-load.md) | Telemetry ingest durability (burst); mobile-side guarantees (P0/P1) |

### `docs/reports/` — [README](./reports/README.md)

Snapshoty audytów (datowane) — nie edytować na żywo; nowy plik przy kolejnym audycie.

### `docs/runbooks/`

| Plik | Opis |
|------|------|
| [db_recovery.md](./runbooks/db_recovery.md) | Disaster recovery DB (Citus / Postgres) |
| [celery-backlog.md](./runbooks/celery-backlog.md) | Rosnące kolejki Celery / OOM workerów |

### `docs/onboarding/` · `docs/product/` · `docs/mockups/`

| Plik | Opis |
|------|------|
| [onboarding/GUIDE.md](./onboarding/GUIDE.md) | Onboarding dev + tenant + wizard mobile |
| [product/FAQ.md](./product/FAQ.md) | FAQ użytkownika końcowego |

**Design mobile (STITCH HTML):** katalog `mockups/` — np. `02-active-ride-hud.html` (referencja UI; pliki `*.html` mogą być gitignored lokalnie). Spec kolorów: [archive/designmobile.md](./archive/designmobile.md) · ADR [006](./adr/006-design-system-stitch.md).

### `docs/archive/` — historyczne

| Plik | Uwaga |
|------|--------|
| [CHARTER.md](./archive/CHARTER.md) | 📦 Deprecated → [CONSTITUTION.md](./CONSTITUTION.md) |
| [TECH_SPEC.md](./archive/TECH_SPEC.md) | 📦 Historyczny |
| [SWOT_ANALYSIS.md](./archive/SWOT_ANALYSIS.md) | 📦 Historyczny |
| [designmobile.md](./archive/designmobile.md) | 📦 Historyczny design mobile |
| [plans/README.md](./archive/plans/README.md) | Redirect do `plans/` poza docs |

### `docs/assets/` · `docs/mockups/`

| Ścieżka | Opis |
|---------|------|
| [assets/README.md](./assets/README.md) | SSOT zasobów graficznych w docs |
| [assets/live/](./assets/live/README.md) | Zrzuty Live Map (opcjonalne PNG) |

---

## Według roli (ścieżki)

| Rola | Ścieżka |
|------|---------|
| **Nowy deweloper** | Getting Started → Installation → Development → Architecture → [ADR-008](./adr/008-backend-strategy.md) |
| **Platform Operator** | [OPERATIONS_INDEX](./operations/OPERATIONS_INDEX.md) → RAILWAY_PRODUCTION_CHECKLIST → `railway-verify-production.ps1` → RAILWAY_CELERY_MEMORY → SIMULATOR |
| **Release Manager** | PRE_RELEASE_VERIFICATION → [COMPLIANCE_INDEX](./compliance/COMPLIANCE_INDEX.md) → P0_SMOKE_CHECKLIST |
| **Admin / Frontend** | [ADMIN_INDEX](./admin/ADMIN_INDEX.md) → P1_ROADMAP · [P2_ROADMAP](./admin/P2_ROADMAP.md) |
| **Mobile release** | [MOBILE.md](./operations/MOBILE.md) → DATA_RESILIENCE |
| **Integrator API** | API → RBAC → Getting Started |
| **DPO / Legal** | [COMPLIANCE_INDEX](./compliance/COMPLIANCE_INDEX.md) → RCP |

---

## Weryfikacja dokumentacji (repo)

```powershell
python scripts/check_docs_links.py
```

Oczekiwany wynik: `OK — checked N markdown files`.

---

> Przy każdej większej zmianie operacyjnej: [MAINTENANCE.md](./MAINTENANCE.md), [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md), odpowiedni indeks sekcji (admin/compliance), data **Last reviewed** powyżej.
