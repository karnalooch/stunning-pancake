# RUNBOOK: Disaster Recovery — utrata bazy danych


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/runbooks/db_recovery.md) |
| **canonical_path** | docs/pl/runbooks/db_recovery.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / DBA |
| **Last reviewed** | 2026-06-03 |
| **Audience** | On-call, DevOps |
| **Cel** | Przywrócenie spójności platformy po krytycznej awarii klastra DB (Citus / Postgres). |

---

## Wymagania wstępne

| Wymaganie | Uwagi |
|-----------|--------|
| Dostęp do backupów | S3 / object storage — **bez** wklejania kluczy w docs |
| `aws` / narzędzie storage | Lista bucketów zgodna z polityką firmy |
| Uprawnienia prod | Railway / hosting — tylko role on-call |
| Komunikacja | Kanał incydentu (nie w repo) |

**Powiązane:** [DISK_GUARD.md](../../DISK_GUARD.md) · [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) · [operations/OPERATIONS_INDEX.md](../../operations/OPERATIONS_INDEX.md)

---

## Procedura

### 1. Izolacja ingestii (rola: Platform Operator)

Zatrzymaj przyjmowanie nowej telemetrii, aby uniknąć niespójności.

```bash
# Przykład: LB zwraca 503 dla /api/telemetry
nginx -s reload
```

### 2. Weryfikacja ostatniego backupu (rola: Platform Operator)

```bash
aws s3 ls s3://sport-backups/citus-main/
```

Potwierdź timestamp ostatniego snapshota przed restore.

### 3. Odtworzenie koordynatora (rola: DBA)

Uruchom nową instancję koordynatora Citus z ostatniego snapshota (procedura specyficzna dla hostingu).

### 4. Re-atachowanie workerów (rola: DBA)

Jeśli dane workerów ocalały — podepnij do nowego koordynatora; w przeciwnym razie restore rozproszony.

### 5. Walidacja integralności (rola: Platform Operator)

```bash
python manage.py check_db_integrity --env production
```

### 6. Przywrócenie ruchu (rola: Platform Operator)

Canary rollout: najpierw telemetria, potem API użytkowników.

---

## Weryfikacja

- [ ] `check_db_integrity` bez błędów krytycznych
- [ ] Próbka loginu + odczyt `users` / `participations`
- [ ] Monitoring: brak spike 5xx po włączeniu ruchu

---

## Rollback

Jeśli restore jest uszkodzony: **nie** włączaj pełnego ruchu; wróć do poprzedniego snapshota lub zamroź platformę (503) do czasu drugiego restore.

---

## Troubleshooting

| Objaw | Przyczyna | Akcja |
|-------|-----------|--------|
| Niespójność users vs participations | Partial restore | Ponów walidację; restore z wcześniejszego snapshota |
| Telemetria „dubluje” okres awarii | Ingestia włączona za wcześnie | Ponowna izolacja ingestii |
| Brak backupu w S3 | Retencja / błąd joba | Eskalacja hosting; DR wg umowy SLA |

---

## Kontakt awaryjny

- On-call: kanał firmowy (nie commituj numerów w repo)
- Hosting: Railway / AWS Priority Support — wg umowy
