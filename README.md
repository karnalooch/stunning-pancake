# 4VELO

4VELO to monorepo platformy sportowej: aplikacja zawodnika, panel administracyjny,
API i usługa przyjmująca telemetrię GPS. Projekt jest w trakcie technicznego
przejęcia i stabilizacji. Obecność funkcji w kodzie nie oznacza jej gotowości produkcyjnej.

## Zacznij tutaj

1. [Przewodnik przejęcia](docs/PROJECT_TAKEOVER.md) — komponenty i kryteria gotowości.
2. [Dokumentacja](docs/README.md) — uruchomienie, rozwój i operacje.
3. [Mapa repozytorium](docs/reports/REPOSITORY_MAP.md) — gdzie szukać kodu.
4. [Macierz poleceń](docs/reports/QUALITY_COMMAND_MATRIX.md) — wyniki lokalnego audytu i jego ograniczenia.
5. [Mapa ryzyka](docs/reports/RISK_AND_OWNERSHIP_MAP.md) — ustalenia wymagające dalszej weryfikacji.

## Komponenty

| Katalog | Odpowiedzialność |
|---|---|
| `backend/` | Django, DRF, modele domenowe, PostGIS, zadania Celery |
| `telemetry/` | FastAPI, ingest GPS, Redis, WebSocket |
| `admin/` | React, Vite, Mantine; opcjonalny wrapper Electron |
| `mobile/` | Expo / React Native, GPS, obsługa offline |
| `packages/` | Kontrakty API, tokeny UI, konfiguracje TypeScript i ESLint |
| `infrastructure/` | Routing, monitoring, konfiguracja Kubernetes i symulatorów |
| `celery-worker*/` | Konfiguracja wdrożeniowa workerów Railway |

## Przygotowanie środowiska

Bazą porównania jest istniejące CI: Node 20, pnpm 9.15 i Python 3.12.
Obrazy usług używają Pythona 3.11. Pełne testy integracyjne wymagają
PostgreSQL/PostGIS oraz Redis. Nie zastępuj ich SQLite.

Zainstaluj zależności JavaScript z głównego katalogu repo:

```bash
corepack pnpm install --frozen-lockfile
```

Dalsze kroki: [uruchomienie lokalne](docs/pl/GETTING_STARTED.md).
Używaj wyłącznie lokalnych danych dostępowych. Przed startem przygotuj `.env`
z `.env.example`, ustaw własny `SECRET_KEY` i zachowaj `RUN_DEMO_SEED=0`.
Pełny Compose zawiera także kosztowne usługi routingowe i symulatory.

## Kontrole

```bash
python scripts/check_docs_links.py
python scripts/check_docs_i18n.py
python scripts/check_config_secrets.py
python scripts/check_openapi_drift.py
corepack pnpm --filter admin lint
corepack pnpm --filter admin typecheck
corepack pnpm --filter admin test:run
corepack pnpm --filter admin build
```

Pełny zakres poleceń i ich wymagania opisuje [macierz jakości](docs/reports/QUALITY_COMMAND_MATRIX.md).
Wynik lokalnego audytu dotyczy konkretnego środowiska i daty. Zielony workflow
nie oznacza, że wykonano każdy test — sprawdź również pominięte zadania.

## Wdrożenie i bezpieczeństwo

W repo współistnieją Railway, Compose i Kubernetes. Konfiguracja w Git nie jest
dowodem, że dana usługa działa na produkcji. Sprawdź [operacje](docs/pl/operations/README.md)
przed wdrożeniem i [procedurę klucza podpisującego](docs/operations/SIGNING_KEY_ROTATION.md)
przed scaleniem zmiany konfiguracji klucza.

[Zasady współpracy](CONTRIBUTING.md) · [Bezpieczeństwo](SECURITY.md) · [Historia zmian](CHANGELOG.md)
