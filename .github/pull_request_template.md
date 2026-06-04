## Summary

<!-- Co i dlaczego (1–3 zdania). -->

## Type

- [ ] feat / fix / docs / chore / refactor / test / perf / security

## Quality (cały monorepo)

Pełna lista: [docs/quality/PR_CHECKLIST.md](docs/quality/PR_CHECKLIST.md)

Infra / Docker / OSRM / BRouter / Railway: [docs/quality/INFRA_PR_CHECKLIST.md](docs/quality/INFRA_PR_CHECKLIST.md)

- [ ] Lokalnie: `.\scripts\run-quality-baseline.ps1` (lub moduły z diff) — zielone
- [ ] Testy dodane lub uzasadnienie
- [ ] `.env.example` + docs jeśli env / API / zachowanie
- [ ] Brak sekretów w diff

## Moduły dotknięte

- [ ] `backend/` · [ ] `telemetry/` · [ ] `admin/` · [ ] `mobile/`
- [ ] `scripts/` · [ ] `docs/` · [ ] `infrastructure/`

## Test plan

<!-- Kroki ręczne lub „CI only”. -->
