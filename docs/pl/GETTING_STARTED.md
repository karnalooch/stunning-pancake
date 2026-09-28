# Uruchomienie lokalne 4VELO

| Pole / Field | Wartość / Value |
|---|---|
| **Status** | Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-09-28 |
| **lang** | pl |
| **translation** | [English](../en/GETTING_STARTED.md) |
| **canonical_path** | docs/pl/GETTING_STARTED.md |

## Zakres

Instrukcja jest oparta na konfiguracji repo. Pełny start Compose wymaga lokalnej
weryfikacji; lista adresów poniżej nie oznacza działających usług.
[Przewodnik przejęcia](../PROJECT_TAKEOVER.md) opisuje ograniczenia projektu.

## Narzędzia

- Git.
- Node.js **24.21.0** (pin w `.nvmrc`; root manifest dopuszcza Node 24 od 24.21.0) oraz pnpm **12.4.2** przez Corepack.
- Docker Desktop / Docker Engine z Compose v2.
- Co najmniej **16 GB RAM** i **40 GB wolnego miejsca** dla Home Laba.
- Python **3.12+** dla narzędzi lokalnych zgodnych z CI; CI używa obecnie Pythona 3.12, a obrazy usług mogą mieć własny przypięty runtime.

## Preflight

Po sklonowaniu repo uruchom read-only doctor przed instalacją zależności i startem usług:

```powershell
git clone https://github.com/karnalooch/stunning-pancake.git 4velo
cd 4velo
python scripts/dev_doctor.py
```

Doctor sprawdza root repo, checkout Git, Pythona, dokładne piny Node/pnpm, Corepack, Docker Compose, dostęp do daemona Dockera, RAM i wolne miejsce. Przy wymaganym błędzie kończy się kodem != 0 i podaje konkretną naprawę. Sprawdza jedynie, czy `.env.home` istnieje — nigdy nie czyta ani nie wypisuje wartości sekretów. Runtime health i końcowy komunikat `DEV ENV READY` należą do T90.

## Przygotowanie

Po zielonym doctorze wykonaj podaną przez niego kanoniczną sekwencję:

```powershell
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install --frozen-lockfile
python scripts/home_lab.py init
```

Zainstaluj zależności z root workspace. `home_lab.py init` tworzy ignorowany,
prywatny plik `.env.home` używany przez izolowany stos lokalny/pilot i odmawia
nadpisania istniejącego pliku. Nie kopiuj do niego sekretów produkcyjnych. Jeżeli
checkout ma już starszy `.env.home`, nie regeneruj go tylko po to, aby dodać nowsze
klucze — użyj procedury z [runbooka home-labu](operations/HOME_LAB.md).

Wygenerowana konfiguracja utrzymuje wyłączony demo seed i zapewnia lokalne sekrety
bazy, GLOBAL_OWNER-a, Django, telemetrii i backupu wymagane przez kanoniczną ścieżkę pilota.

## Start i kontrola

```powershell
python scripts/home_lab.py config
python scripts/home_lab.py up
python scripts/home_lab.py status
python scripts/home_lab.py check
```

To jest kanoniczna ścieżka lokalna/pilot. **Nie** zastępuj jej gołym
`docker compose up`: Docker Compose automatycznie dołącza wtedy
`docker-compose.override.yml`, podczas gdy pilot home lab świadomie warstwuje tylko
`docker-compose.yml` + `docker-compose.home.yml` w projekcie `4velo-home`.

Domyślny rdzeń home-labu uruchamia PostGIS/TimescaleDB, Redis, Django, telemetry,
panel GLOBAL_OWNER, główny worker Celery i beat. Routing, symulacja, tracking i
dodatkowe panele admina są profilami opcjonalnymi; włączaj je przez
`home_lab.py up --routing|--simulation|--tracking|--all-admin`. Pierwszy build i
przygotowanie danych routingu mogą trwać dłużej niż start rdzenia.

| Usługa | Oczekiwany lokalny adres |
|---|---|
| API / dokumentacja | http://localhost:8000/api/docs/ |
| Global Admin | http://localhost:3001 |
| Tenant Admin (z `--all-admin`) | http://localhost:3002 |
| Moderator (z `--all-admin`) | http://localhost:3003 |
| Telemetry | http://localhost:8001 |

Adresy wynikają z Compose, nie z wykonanego testu dostępności.
Sprawdź lokalne logi usługi, jeśli kontener restartuje się. Nigdy nie publikuj
sekretów ani pełnych logów zawierających dane użytkowników.

## Testy i zakończenie pracy

[Macierz poleceń](../reports/QUALITY_COMMAND_MATRIX.md) podaje wymagania i wyniki
audytu. Testy PostGIS wymagają PostGIS, a nie zastępczej bazy SQLite.

```bash
python scripts/check_docs_links.py
corepack pnpm --filter admin typecheck
corepack pnpm --filter admin test:run
python scripts/home_lab.py down
```

`home_lab.py down` usuwa kontenery/sieć home-labu, ale zachowuje nazwany wolumen bazy.
Nie używaj `docker compose down -v` do zwykłego zakończenia pracy.

## Wdrożenie i dalsze kroki

Wdrożenie nie jest częścią lokalnego startu. Przeczytaj [operacje](operations/README.md)
i [mapę ryzyka](../reports/RISK_AND_OWNERSHIP_MAP.md) przed konfiguracją Railway lub
Kubernetes. Nie seeduj produkcji ani nie uruchamiaj migracji przeciw zewnętrznej bazie
w ramach prób lokalnych.

[Development](DEVELOPMENT.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Indeks](README.md)
