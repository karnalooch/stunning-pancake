# 4VELO — dokumentacja

**Ostatni przegląd indeksu:** 2026-06-02 (API symulator, mobile runbook, ADR-010)  
**Język:** polski (runbooki i przewodniki operatora)

---

## Contributing

| Dokument | Opis |
|----------|------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR workflow, testy, kiedy aktualizować docs |
| [MAINTENANCE.md](./MAINTENANCE.md) | Inwentarz świeżości, checklista release |

## Start

| Dokument | Opis |
|----------|------|
| [Getting Started](./GETTING_STARTED.md) | Od zera do działającego środowiska (~15 min) |
| [Installation](./INSTALLATION.md) | Docker Compose, lokalne zależności, porty |
| [Development](./DEVELOPMENT.md) | Struktura repo, testy, Git workflow |

---

## Operacje (produkcja / Railway)

| Dokument | Opis |
|----------|------|
| **[operations/](./operations/)** | **Runbooki** — symulator, BRouter, skróty |
| [Railway — worker symulacji](./RAILWAY_CELERY_SIMULATION.md) | `celery-worker-simulation`, kolejka `simulation` |
| [Kubernetes runbook](./operations/KUBERNETES.md) | Deploy API + Celery + Redis + BRouter na klastrze k8s |
| [Pre-release verification](./operations/PRE_RELEASE_VERIFICATION.md) | Single-command gate + checklista release (CI/reliability/compliance) |
| [Disk guard](./DISK_GUARD.md) | Budżet Postgres, pauza zapisów |
| [Scale test 300k](./SCALE_TEST_300K.md) | Duży test obciążeniowy |
| [Event burst 50k](./EVENT_BURST_50K.md) | Dzień eventu |
| [Troubleshooting](./TROUBLESHOOTING.md) | CORS, DB, Celery, symulator, BRouter |
| [Deployment](./DEPLOYMENT.md) | Wdrożenie, SSL, backupy |

---

## Architektura i API

| Dokument | Opis |
|----------|------|
| [Architecture](./ARCHITECTURE.md) | Backend, mobile, anti-cheat, PostGIS |
| [Department architecture](./DEPARTMENT_ARCHITECTURE.md) | Działy / tenant |
| [C4 diagrams](./diagrams/architecture_c4.md) | Diagramy kontekstu |
| [API Reference](./API.md) | REST, auth, webhooks |
| [RBAC](./RBAC.md) | Role i uprawnienia |
| [Simulator architecture](./SIMULATOR_ARCHITECTURE.md) | Spec Redis + Celery (implementacja gotowa) |
| [Data resilience](./DATA_RESILIENCE.md) | Odporność danych |

---

## Konfiguracja i proces

| Dokument | Opis |
|----------|------|
| [Configuration](./CONFIGURATION.md) | Django, Redis, integracje |
| [Migration](./MIGRATION.md) | Migracje DB, rollback |
| [Updates](./UPDATES.md) | Aktualizacja zależności i obrazów |
| [MAINTENANCE.md](./MAINTENANCE.md) | **Inwentarz docs, luki, checklista** |
| [CHANGELOG](../CHANGELOG.md) | Historia wydań |

---

## Admin panel

| Dokument | Opis |
|----------|------|
| [admin/README.md](./admin/README.md) | Design system, komponenty |
| [admin/ROADMAP_V3.md](./admin/ROADMAP_V3.md) | Roadmap v3 |

---

## Decyzje i zgodność

| Dokument | Opis |
|----------|------|
| [ADR](./adr/) | Architecture Decision Records (001–010) |
| [DATA_RESILIENCE.md](./DATA_RESILIENCE.md) | GPS buffer, outbox, recovery (mobile) |
| [Constitution](./CONSTITUTION.md) | Zasady projektu |
| [RCP](./compliance/RCP.md) | RODO / compliance |
| [Release legal package](./compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | OSS/GDPR/ToS + Go/No-Go template dla release |
| [Onboarding](./onboarding/GUIDE.md) | Onboarding dewelopera |

---

## Raporty (snapshoty — nie „żywa” dokumentacja)

| Dokument | Data |
|----------|------|
| [reports/](./reports/) | Audyty i gap reporty |
| [runbooks/db_recovery.md](./runbooks/db_recovery.md) | Odtwarzanie DB |

## Archiwum

| Dokument | Opis |
|----------|------|
| [archive/](./archive/) | CHARTER, TECH_SPEC, SWOT — historyczne |

---

## Według roli

**Nowy deweloper:** Getting Started → Installation → Development → Architecture → ADR-008.

**Operator / load test:** [operations/SIMULATOR.md](./operations/SIMULATOR.md) → RAILWAY_CELERY_SIMULATION → DISK_GUARD → Troubleshooting.

**Integrator API:** API → RBAC → Getting Started.

---

> Utrzymanie tego indeksu: przy każdej większej zmianie operacyjnej zaktualizuj [MAINTENANCE.md](./MAINTENANCE.md) i datę powyżej.
