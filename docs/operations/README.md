# Operacje — runbooki produkcyjne

Krótkie przewodniki „co zrobić na Railway / w symulatorze”. Szczegóły architektury → [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md).

| Runbook | Opis |
|---------|------|
| [SIMULATOR.md](./SIMULATOR.md) | Batch użytkowników, live map, kolejność startu, env, mapa admin |
| [BROUTER.md](./BROUTER.md) | Serwis BRouter, kafelki Polski, routing `pass=0` |
| [KUBERNETES.md](./KUBERNETES.md) | Bazowe manifesty k8s: API, Celery, Redis, BRouter, ingress, HPA |
| [RAILWAY_KUBERNETES.md](./RAILWAY_KUBERNETES.md) | Railway **nie** hostuje K8s; Opcja B (skalowanie) vs migracja GKE/k3s |
| [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) | Single-command gate + CI/reliability/compliance checklist przed release |
| [MOBILE.md](./MOBILE.md) | GPS MMKV, NetInfo, recovery przy starcie aplikacji |
| [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md) | Worker `celery-worker-simulation`, zmienne Railway |
| [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) | OOM SIGKILL, concurrency, BRouter caps, self-heal |
| [../DISK_GUARD.md](../DISK_GUARD.md) | Budżet dysku Postgres, pauza symulacji |
| [../SCALE_TEST_300K.md](../SCALE_TEST_300K.md) | Test 300k użytkowników |
| [../EVENT_BURST_50K.md](../EVENT_BURST_50K.md) | Burst przy dniu eventu |
| [../../infrastructure/brouter/README.md](../../infrastructure/brouter/README.md) | Dockerfile, volume, preset `poland` |

**Ostatnia aktualizacja:** 2026-06-02
