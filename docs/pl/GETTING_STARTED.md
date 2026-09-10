# Uruchomienie lokalne 4VELO

| Pole / Field | Wartość / Value |
|---|---|
| **Status** | Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-09-10 |
| **lang** | pl |
| **translation** | [English](../en/GETTING_STARTED.md) |
| **canonical_path** | docs/pl/GETTING_STARTED.md |

## Zakres

Instrukcja jest oparta na konfiguracji repo. Pełny start Compose wymaga lokalnej
weryfikacji; lista adresów poniżej nie oznacza działających usług.
[Przewodnik przejęcia](../PROJECT_TAKEOVER.md) opisuje ograniczenia projektu.

## Narzędzia

- Git, Node 20 (wersja w CI), pnpm 9.15.
- Docker z Compose 2 i zasoby na PostGIS, Redis oraz routing.
- Python 3.12 dla narzędzi lokalnych zgodnych z CI; obrazy usług używają 3.11.

## Przygotowanie

```powershell
git clone https://github.com/karnalooch/stunning-pancake.git 4velo
cd 4velo
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Kopiowanie `.env` wykonuj tylko przy pierwszym przygotowaniu. W Bash użyj
`cp .env.example .env`. Zainstaluj zależności z root workspace.
W lokalnym `.env` zastąp istniejące wartości, nie dopisuj drugiego `SECRET_KEY`.
Ustaw własny losowy klucz, parametry bazy wymagane przez Compose oraz `DEBUG=1`
wyłącznie lokalnie. Nie używaj dostępu do produkcji.

Zachowaj `RUN_DEMO_SEED=0`. Konto administratora powstaje przy pierwszym starcie
backendu bez seedowania demo. Domyślna nazwa to `global_owner`; jeśli hasło nie
zostało przekazane do kontenera, jednorazowe hasło będzie w jego logu. Sam wpis
w `.env` nie przekazuje automatycznie dowolnej zmiennej do kontenera — sprawdź
sekcję `environment` usługi. Nie publikuj logu pierwszego startu.

## Start i kontrola

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Compose obejmuje również BRouter, OSRM, Traccar i symulatory; pierwszy build oraz
pobieranie map mogą trwać długo. Backend domyślnie wykonuje migracje, tworzy
administratora, zbiera statyczne pliki i uruchamia Gunicorna. Nie generuje nowych
migracji podczas startu. Workery i beat wykonują własne komendy bez inicjalizacji
serwera WWW. Uruchom testy dopiero po gotowości bazy i migracji backendu.

| Usługa | Oczekiwany lokalny adres |
|---|---|
| API / dokumentacja | http://localhost:8000/api/docs/ |
| Global Admin | http://localhost:3001 |
| Tenant Admin | http://localhost:3002 |
| Moderator | http://localhost:3003 |
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
docker compose stop
```

`stop` zachowuje dane i kontenery. Nie używaj `down -v` do zwykłego zakończenia pracy.

## Wdrożenie i dalsze kroki

Wdrożenie nie jest częścią lokalnego startu. Przeczytaj [operacje](operations/README.md)
i [mapę ryzyka](../reports/RISK_AND_OWNERSHIP_MAP.md) przed konfiguracją Railway lub
Kubernetes. Nie seeduj produkcji ani nie uruchamiaj migracji przeciw zewnętrznej bazie
w ramach prób lokalnych.

[Development](DEVELOPMENT.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Indeks](README.md)
