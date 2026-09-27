# Domowe środowisko testowe 4VELO
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-28 |
| **Audience** | Developers and operators |
| **lang** | pl |
| **translation** | [English](../../en/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-28 |
| **canonical_path** | docs/pl/operations/HOME_LAB.md |

---

Domowy lab odtwarza granice usług używane przez pilota, ale korzysta wyłącznie z lokalnego projektu Compose `4velo-home`, prywatnego pliku `.env.home` i wolumenów Dockera. Nie kopiuj do niego sekretów ani danych produkcyjnych.

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

`init` tworzy ignorowany plik `.env.home` i odmawia nadpisania istniejącego pliku. Generuje niezależne lokalne wartości dla hasła bazy, dedykowanego `ADMIN_PASSWORD` GLOBAL_OWNER-a, Django `SECRET_KEY`, sekretu podpisującego JWT telemetrii oraz klucza AES-256 do backupów. Wartości sekretów nigdy nie trafiają do evidence T87.

`up` waliduje warstwowy model Compose, buduje obrazy, czeka na healthchecki usług, a następnie sprawdza HTTP backendu, telemetrii i panelu GLOBAL_OWNER.

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

`check` wymaga uruchomienia wszystkich usług rdzenia oraz sprawdza HTTP backendu, telemetrii i panelu GLOBAL_OWNER. `down` zatrzymuje kontenery, lecz zachowuje wolumen bazy. Nie używaj `docker compose down -v`, jeżeli nie chcesz usunąć lokalnych danych.

## T87 — brama operatora pilota

Kanoniczną bramę uruchamiaj z dokładnie tego czystego checkoutu Git, który ma trafić do pilota, po uruchomieniu usług rdzenia:

```powershell
git status --short
python scripts/home_lab.py operator-gate
```

Komenda działa fail-closed: wymaga zainicjalizowanej konfiguracji pilota i zachowania wymaganych invariantów runtime. Następnie:

1. wiąże wykonanie z dokładnym, czystym commitem Git;
2. waliduje warstwową konfigurację Compose;
3. sprawdza HTTP backendu, telemetrii i panelu GLOBAL_OWNER;
4. dowodzi braku oczekujących migracji Django przez `migrate --check`;
5. tworzy uwierzytelniony backup AES-256-GCM bez zapisywania plaintextu na dysku;
6. odtwarza backup wyłącznie do izolowanej bazy `4velo_restore_check`, a potem usuwa bazę weryfikacyjną;
7. zapisuje pozbawiony sekretów artefakt JSON PASS w `backups/home-lab/evidence/t87-operator-*.json`.

Evidence zawiera SHA commita, znaczniki czasu, zsanityzowane wyniki invariantów, endpointy, wynik migracji, nazwę/hash zaszyfrowanego backupu oraz wynik izolowanego restore. Nie zawiera haseł, kluczy podpisujących, Django secret ani klucza szyfrowania backupu.

Repo-side T87 po zielonym CI nadal ma status **PARTIAL**, dopóki ta komenda nie zostanie wykonana na dokładnym docelowym środowisku pilota i evidence nie zostanie przejrzane.

## Backup i próba odtworzenia

Pojedyncze prymitywy backup/restore nadal są dostępne:

```powershell
python scripts/home_lab.py backup
python scripts/home_lab.py verify-restore backups/home-lab/4velo-home-YYYYMMDD-HHMMSS.dump.enc
```

Artefakt jest uwierzytelnioną, zaszyfrowaną AES-256-GCM osłoną danych custom `pg_dump` bez właścicieli i ACL. Plaintext jest strumieniowany bezpośrednio do szyfrowania i nie jest zapisywany na dysku. `verify-restore` uwierzytelnia i odszyfrowuje artefakt do oddzielnej bazy `4velo_restore_check`, sprawdza tabelę migracji, a następnie usuwa bazę weryfikacyjną. Nigdy nie modyfikuje aktywnej bazy home-labu.

Skrypt celowo nie ma komendy odtwarzania nad aktywną bazą.

## Krytyczna ścieżka testowa

Po pozytywnym T87 operator gate osobno pozostają role/runtime acceptance T84/T85/T86: fizyczny Android, smoke TENANT_ADMIN oraz smoke roli GLOBAL_OWNER mają własne granice evidence.

Domowy lab nie potwierdza domen produkcyjnych, TLS, backupów zarządzanych przez dostawcę, wydajności produkcyjnej ani zmiennych Railway. Potwierdza kontrolowaną przez repo konfigurację pilota, migracje, komunikację usług rdzenia, zaszyfrowany backup i izolowany restore przed sign-off pilota.
