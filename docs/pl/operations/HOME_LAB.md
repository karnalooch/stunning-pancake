# Domowe środowisko testowe 4VELO
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-10 |
| **Audience** | Developers and operators |
| **lang** | pl |
| **translation** | [English](../../en/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-10 |
| **canonical_path** | docs/pl/operations/HOME_LAB.md |

---

Domowy lab odtwarza granice usług używane później na Railway, ale korzysta wyłącznie z lokalnego projektu Compose `4velo-home`, pliku `.env.home` i wolumenów Dockera. Nie kopiuj do niego sekretów ani danych produkcyjnych.

## Wymagania

- Docker Desktop z WSL2 albo Docker Engine z obsługą `docker compose`;
- co najmniej 16 GB RAM i 40 GB wolnego miejsca;
- Git oraz Python 3.12+ do skryptu sterującego.

## Pierwsze uruchomienie

```powershell
python scripts/home_lab.py init
python scripts/home_lab.py config
python scripts/home_lab.py up
```

`init` tworzy ignorowany plik `.env.home` z trzema niezależnymi losowymi sekretami. Odmawia nadpisania istniejącego pliku. `up` najpierw sprawdza konfigurację Compose, buduje obrazy, czeka na healthchecki i sprawdza HTTP backendu oraz telemetrii.

Domyślny rdzeń obejmuje PostGIS/TimescaleDB, Redis, Django, telemetry, global admin, podstawowy worker Celery i beat. Dodatki włączaj świadomie:

```powershell
python scripts/home_lab.py up --routing
python scripts/home_lab.py up --simulation
python scripts/home_lab.py up --tracking
python scripts/home_lab.py up --all-admin
```

Profile można łączyć. `simulation` uruchamia również BRouter i OSRM. Pierwsze przygotowanie danych routingu może pobrać duże pliki i potrwać znacznie dłużej niż start rdzenia.

## Codzienna obsługa

```powershell
python scripts/home_lab.py status
python scripts/home_lab.py check
python scripts/home_lab.py down
```

`down` zatrzymuje kontenery, lecz zachowuje wolumen bazy. Nie używaj `docker compose down -v`, jeżeli nie chcesz usunąć lokalnych danych.

## Backup i próba odtworzenia

```powershell
python scripts/home_lab.py backup
python scripts/home_lab.py verify-restore backups/home-lab/4velo-home-YYYYMMDD-HHMMSS.dump
```

Backup ma format custom `pg_dump`, bez właścicieli i ACL. `verify-restore` tworzy w tym samym lokalnym kontenerze oddzielną bazę `4velo_restore_check`, odtwarza plik, sprawdza tabelę migracji, a następnie usuwa bazę kontrolną. Nie modyfikuje głównej bazy labu.

Skrypt celowo nie ma komendy odtwarzania nad główną bazą. Pozytywna próba w bazie kontrolnej jest warunkiem przygotowania osobnej, jawnej procedury disaster recovery.

## Krytyczna ścieżka testowa

Po zielonym `check` wykonaj kolejno: logowanie do panelu, utworzenie użytkownika testowego, zapis aktywności, ingest punktów GPS z ważnym JWT, odebranie zadania przez Celery i sprawdzenie danych w panelu. Wynik zapisz z wersją commita oraz nazwą pliku backupu.

Domowy lab nie potwierdza domen, TLS, backupów dostawcy, wydajności ani zmiennych Railway. Pozwala jednak sprawdzić obrazy, migracje, komunikację usług i odtwarzanie danych przed wdrożeniem.
