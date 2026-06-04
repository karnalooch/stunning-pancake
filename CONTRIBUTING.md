# Contributing to 4VELO

Dziękujemy za udział w rozwoju platformy. Ten plik opisuje minimalny workflow; szczegóły techniczne są w [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Zanim zaczniesz

1. Przeczytaj [docs/README.md](docs/README.md) — indeks dokumentacji.
2. Luki bezpieczeństwa: [SECURITY.md](SECURITY.md) (nie otwieraj publicznych issue z exploitami).
3. Uruchom środowisko: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) lub `.\dev.ps1`.
4. Dla zmian w symulatorze / Railway: [docs/operations/](docs/operations/).

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

---

## Dokumentacja (obowiązkowo przy zmianach zachowania)

| Zmieniasz | Zaktualizuj |
|----------|-------------|
| API admin / symulator | [docs/API.md](docs/API.md), [docs/operations/SIMULATOR.md](docs/operations/SIMULATOR.md) |
| Env `SCALE_*`, `BROUTER_*` | [docs/CONFIGURATION.md](docs/CONFIGURATION.md), `.env.example`, [docs/operations/](docs/operations/) |
| BRouter / Docker | [infrastructure/brouter/README.md](infrastructure/brouter/README.md), [docs/operations/BROUTER.md](docs/operations/BROUTER.md) |
| Mobile GPS / telemetry | [docs/DATA_RESILIENCE.md](docs/DATA_RESILIENCE.md), [docs/operations/MOBILE.md](docs/operations/MOBILE.md) |
| Live Map UI | [docs/admin/README.md](docs/admin/README.md) |
| Decyzja architektoniczna | Nowy plik w [docs/adr/](docs/adr/) |
| Wydanie użytkownika | [CHANGELOG.md](CHANGELOG.md) |

Checklist utrzymania: [docs/MAINTENANCE.md](docs/MAINTENANCE.md).

---

## CI

- **SPORT CI/CD** — backend, telemetry, mobile, admin, scripts, tokens, docs links, audit, E2E (`.github/workflows/ci.yml`).
- **Documentation** (push do `docs/` tylko) — `.github/workflows/docs.yml`.
- **Jakość** — program faz 0–5: [docs/quality/README.md](docs/quality/README.md).

---

## Code review

- Nie commituj sekretów (`.env`, klucze API).
- RBAC: zmiany tras admin wymagają zgodności z [docs/RBAC.md](docs/RBAC.md).
- Symulator: nie łam kolejności **batch → live** bez uzasadnienia w PR.
