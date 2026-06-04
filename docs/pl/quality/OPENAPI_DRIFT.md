# Dryf dokumentacji OpenAPI/API

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../quality/OPENAPI_DRIFT.md) |
| **canonical_path** | docs/pl/quality/OPENAPI_DRIFT.md |
---

**Ostatnia recenzja:** 2026-06-04

## SSOT

| Artefakt | Rola |
|-------------|------|
| [docs/API.md](../API.md) | Umowa czytelna dla człowieka + przykłady |
| `/api/schemat/` | Wygenerowano OpenAPI (Django) |
| `scripts/check_openapi_drift.py` | Strażnik CI na ścieżkach krytycznych wymienionych w API.md |

## Po zmianie procedur obsługi REST

1. Zaktualizuj `docs/API.md` (ścieżka, metoda, autoryzacja, ładunek).
2. Sprawdź Swagger: `/api/docs/` lokalnie.
3. Uruchom `python scripts/check_openapi_drift.py` (również w zadaniu CI `scripts-python`).

## Lista kontrolna PR

Zobacz [PR_CHECKLIST.md](./PR_CHECKLIST.md) — dodaj zaznaczenie, jeśli dotknąłeś `admin_views.py`, serializatorów lub `urls.py` w obszarze `backend/`.

## Wysuwanie osłony

Dodaj ścieżki do `CRITICAL_PATHS` w `scripts/check_openapi_drift.py`, gdy trasa stanie się krytyczna operacyjnie (administrator symulatora, pozyskiwanie, uwierzytelnianie).
