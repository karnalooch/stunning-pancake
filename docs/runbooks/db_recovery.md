# RUNBOOK: Disaster Recovery — Utrata Bazy Danych

## Cel
Przywrócenie pełnej sprawności platformy SPORT po krytycznej awarii klastra Citus.

## Procedura (Krok po kroku)

### 1. Izolacja Ingestii
Zatrzymaj przyjmowanie nowych danych telemetrii, aby uniknąć niespójności.
```bash
# Na serwerze Load Balancer
nginx -s reload # Z konfiguracją zwracającą 503 dla /api/telemetry
```

### 2. Weryfikacja ostatniego backupu
Sprawdź dostępność obrazów w S3/Cloud Storage.
```bash
# Przykład dla AWS CLI
aws s3 ls s3://sport-backups/citus-main/
```

### 3. Odtworzenie Koordynatora
Uruchom nową instancję koordynatora Citus z ostatniego snapshota.

### 4. Re-atachowanie Workerów
Jeśli dane workerów ocalały, podepnij je do nowego koordynatora. Jeśli nie, odtwórz je z backupu rozproszonego.

### 5. Walidacja Integralności
Uruchom skrypt sprawdzający spójność między tabelami `users` i `participations`.
```bash
python manage.py check_db_integrity --env production
```

### 6. Przywrócenie Ruchu
Włącz stopniowo ruch (Canary Rollout), zaczynając od telemetrii (Ingestion Layer).

## Kontakt Awaryjny
- System On-Call: [Twoje Dane Kontaktowe]
- Hosting Support: Railway / AWS Priority Support
