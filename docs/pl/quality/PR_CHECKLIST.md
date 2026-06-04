# Lista kontrolna żądania ściągnięcia (Faza 4)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../quality/PR_CHECKLIST.md) |
| **canonical_path** | docs/pl/quality/PR_CHECKLIST.md |
---

Skopiuj do opisu PR lub użyj szablonu `.github/pull_request_template.md`.

## Zachowanie i dokumentacja

- [ ] Opis **dlaczego** (nie tylko co)
- [ ] [CHANGELOG.md](../../../CHANGELOG.md) jeśli user-visible
- [ ] [CONTRIBUTING.md](../../../CONTRIBUTING.md) — tabela docs zaktualizowana jeśli API/env/zachowanie
- [ ] ADR / `docs/operations/` jeśli decyzja architektoniczna lub runbook

## Jakość kodu

- [ ] `.\scripts\run-quality-baseline.ps1` zielony (lub odpowiednie moduły z [README](./README.md))
- [ ] Test dodany lub uzasadnienie (bugfix na ścieżce krytycznej = test)
- [ ] Brak sekretów w diff
- [ ] PR < ~500 linii logiki (rozbić jeśli większy)

## Ścieżki krytyczne (jeśli dotykasz)

- [ ] **GPS / ingest:** outbox, 202/ACK, nie czyścić bufora na samym 2xx
- [ ] **RBAC admin:** zgodność z [RBAC.md](../../RBAC.md), `npm run audit:rbac`
- [ ] **Symulator:** kolejność batch → live bez uzasadnionego łamania
- [ ] **Env:** `.env.example` + Railway docs
- [ ] **Infra:** [INFRA_PR_CHECKLIST.md](./INFRA_PR_CHECKLIST.md) if `infrastructure/`, compose, or routing images
- [ ] **API docs:** `python scripts/check_openapi_drift.py` if REST paths changed — [OPENAPI_DRIFT.md](./OPENAPI_DRIFT.md)

## Review

- [ ] Min. 1 approve (Konstytucja §5.5)
- [ ] CI zielone na branchu
