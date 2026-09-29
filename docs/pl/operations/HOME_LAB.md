# Domowe środowisko testowe 4VELO
| | |
|--|--|
| **Status** | Active |
| **Owner role** | Platform maintainer |
| **Last reviewed** | 2026-09-29 |
| **Audience** | Developers and operators |
| **lang** | pl |
| **translation** | [English](../../en/operations/HOME_LAB.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-09-29 |
| **canonical_path** | docs/pl/operations/HOME_LAB.md |

---

Domowy lab odtwarza granice usług używane przez pilota, ale korzysta wyłącznie z lokalnego projektu Compose `4velo-home`, prywatnego pliku `.env.home` i wolumenów Dockera. Nie kopiuj do niego sekretów ani danych produkcyjnych.

Używaj `python scripts/home_lab.py ...` jako jedynej kanonicznej ścieżki sterowania. Gołe `docker compose ...` nie jest równoważne, ponieważ Compose automatycznie dołącza `docker-compose.override.yml`; ścieżka pilota świadomie i jawnie warstwuje wyłącznie `docker-compose.yml`, a po nim `docker-compose.home.yml`.

## Wymagania

- Git;
- Node.js 24.21.0 i pnpm 12.4.2 przez Corepack;
- Python 3.12;
- Docker Desktop albo Docker Engine z Docker Compose v2.

Kanoniczne wymagania hosta sprawdza read-only `python scripts/dev_doctor.py`; runbook nie utrzymuje osobnych, arbitralnych progów RAM/dysku.

## Pierwsze uruchomienie

```powershell
python scripts/home_lab.py init
python scripts/home_lab.py cold-start-smoke
```

`init` tworzy ignorowany plik `.env.home` i odmawia nadpisania istniejącego pliku. Generuje niezależne lokalne wartości dla hasła bazy, dedykowanego `ADMIN_PASSWORD` GLOBAL_OWNER-a, Django `SECRET_KEY`, sekretu podpisującego JWT telemetrii oraz klucza AES-256 do backupów. Wartości sekretów nigdy nie trafiają do evidence T87.

`up` waliduje warstwowy model Compose, uruchamia profilowany jednorazowy bootstrap `backend_migrate` z uprzywilejowanym właścicielem bazy, a dopiero potem startuje usługi runtime przez `up -d --build --wait` i sprawdza HTTP backendu, telemetrii i panelu GLOBAL_OWNER. Kontenery runtime backendu/workera nigdy nie dostają credentiala właściciela migracji.

Dla home-labu utworzonego przed T87 **nie** usuwaj i nie generuj ponownie `.env.home` tylko po to, aby dodać to pole — obróciłoby to również hasło bazy i klucze podpisujące. Przed kolejnym `up` dopisz silny lokalny `ADMIN_PASSWORD` do istniejącego prywatnego pliku. Jeżeli konto GLOBAL_OWNER już istnieje, nie zmienia to jego dotychczasowego hasła; akceptacja logowania roli nadal należy do osobnego runtime smoke T86.

Domyślny rdzeń obejmuje PostGIS/TimescaleDB, Redis, Django, telemetry, global admin, podstawowy worker Celery i beat. Dodatki włączaj świadomie:

```powershell
python scripts/home_lab.py up --routing
python scripts/home_lab.py up --simulation
python scripts/home_lab.py up --tracking
python scripts/home_lab.py up --all-admin
```

Profile można łączyć. `simulation` uruchamia również BRouter i OSRM. Pierwsze przygotowanie danych routingu może pobrać duże pliki i potrwać znacznie dłużej niż start rdzenia.

## T90 — cold-start smoke i `DEV ENV READY`

Po zielonym doctorze i jednorazowym `init` kanoniczny dowód gotowości środowiska uruchamiaj jedną komendą:

```powershell
python scripts/home_lab.py cold-start-smoke
```

Ten sam prymityw migracyjny można też uruchomić jawnie do obsługi operatorskiej/debugowania:

```powershell
python scripts/home_lab.py migrate
```

Komenda działa fail-closed i z czystego stanu procesów wykonuje `down --remove-orphans` **bez `-v`**, więc zachowuje wolumeny i lokalne dane. Następnie waliduje dokładnie `docker-compose.yml` + `docker-compose.home.yml`, najpierw wykonuje jednorazowy bootstrap `backend_migrate`, a dopiero po jego sukcesie uruchamia `up -d --build --wait`. Sprawdza usługi rdzenia i HTTP backendu/telemetrii/GLOBAL_OWNER, brak oczekujących migracji Django oraz aktywne ścieżki PostgreSQL, Redis i głównego workera Celery.

Po pełnym PASS zapisuje pozbawione sekretów evidence powiązane z dokładnym SHA do `backups/home-lab/evidence/t90-dev-env-ready-*.json`. Tylko ten pełny kontrakt wypisuje `DEV ENV READY`. Nie używaj samego `docker compose up`, statusu kontenera ani pojedynczego health endpointu jako równoważnego dowodu.

Ponowne uruchomienie jest bezpieczne: smoke najpierw usuwa stare kontenery/orphans, ale nie usuwa nazwanych wolumenów. Po awarii częściowo uruchomiony stos może pozostać do diagnostyki; kolejny smoke zaczyna ponownie od kontrolowanego restartu.

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

T87 ma status **DONE**: operator gate wykonano na docelowym home-labie pilota dla czystego commita `5085b5215e6ff82a7397685252a42525f86113b8`. Health HTTP i migracje przeszły, utworzono zaszyfrowany backup `4velo-home-20260927-235157.dump.enc`, izolowany restore przeszedł, a evidence powiązane z commitem zapisano w `backups/home-lab/evidence/t87-operator-20260927-235202.json`.

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
