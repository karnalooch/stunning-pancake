# Contributing to 4VELO

Dziękujemy za udział w rozwoju platformy. Ten plik opisuje minimalny workflow; szczegóły techniczne są w [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Zanim zaczniesz

1. Przeczytaj [docs/pl/README.md](docs/pl/README.md) (PL, kanoniczny) lub [docs/en/README.md](docs/en/README.md) (EN). Stare ścieżki (`docs/README.md`, `docs/GETTING_STARTED.md`, …) to przekierowania fazy 2.
2. Luki bezpieczeństwa: [SECURITY.md](SECURITY.md) (nie otwieraj publicznych issue z exploitami).
3. Zainstaluj zależności z **root** monorepo: `pnpm install` (wymaga [pnpm](https://pnpm.io/) 9.x; bez globalnego pnpm: `npx pnpm@9.15.0 install`). **Nie** używaj `npm install` w `admin/` — `workspace:*` wymaga pnpm.
4. Opcjonalnie hooki lokalne: `pip install pre-commit && pre-commit install` (Ruff, `pnpm tokens:check`, docs links).
5. Uruchom środowisko: [docs/pl/GETTING_STARTED.md](docs/pl/GETTING_STARTED.md) lub `.\dev.ps1` (legacy: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)).
6. Dla zmian w symulatorze / Railway: [docs/pl/operations/](docs/pl/operations/) (EN: [docs/en/operations/](docs/en/operations/)).

---

## Git workflow

1. Branch z `main`: `feature/krótki-opis` lub `fix/issue-opis`.
2. Małe, logiczne commity (Conventional Commits mile widziane):
   - `feat(admin): …`
   - `fix(simulator): …`
   - `docs: …`
3. Przed PR — **cały monorepo** (Faza 0):
   ```powershell
   .\scripts\run-quality-baseline.ps1
   ```
   Lub ręcznie: [docs/quality/README.md](docs/quality/README.md). Checklista PR: [docs/quality/PR_CHECKLIST.md](docs/quality/PR_CHECKLIST.md).
   Vitest (admin): `pnpm test:admin` z root lub `pnpm --filter admin test:run`.

---

## Dokumentacja (obowiązkowo przy zmianach zachowania)

| Zmieniasz | Zaktualizuj |
|----------|-------------|
| API admin / symulator | [docs/API.md](docs/API.md), [docs/pl/operations/SIMULATOR.md](docs/pl/operations/SIMULATOR.md) |
| Env `SCALE_*`, `BROUTER_*` | [docs/pl/CONFIGURATION.md](docs/pl/CONFIGURATION.md), `.env.example`, [docs/pl/operations/](docs/pl/operations/) |
| BRouter / Docker | [infrastructure/brouter/README.md](infrastructure/brouter/README.md), [docs/pl/operations/BROUTER.md](docs/pl/operations/BROUTER.md) |
| Mobile GPS / telemetry | [docs/pl/DATA_RESILIENCE.md](docs/pl/DATA_RESILIENCE.md), [docs/pl/operations/MOBILE.md](docs/pl/operations/MOBILE.md) |
| Live Map UI | [docs/admin/README.md](docs/admin/README.md) |
| Decyzja architektoniczna | Nowy plik w [docs/adr/](docs/adr/) |
| Wydanie użytkownika | [CHANGELOG.md](CHANGELOG.md) |

Checklist utrzymania: [docs/MAINTENANCE.md](docs/MAINTENANCE.md).

---

## CI

- **4VELO CI/CD** — backend, telemetry, mobile, admin, scripts, tokens, docs links, audit, E2E (`.github/workflows/ci.yml`).
- **Documentation** (push do `docs/` tylko) — `.github/workflows/docs.yml`.
- **Jakość** — program faz 0–5: [docs/quality/README.md](docs/quality/README.md).

---

## Code review

- Nie commituj sekretów (`.env`, klucze API).
- RBAC: zmiany tras admin wymagają zgodności z [docs/RBAC.md](docs/RBAC.md).
- Symulator: nie łam kolejności **batch → live** bez uzasadnienia w PR.
