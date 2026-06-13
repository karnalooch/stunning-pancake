# Dokumentacja — zasoby graficzne (`docs/assets/`)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/assets/README.md) |
| **canonical_path** | docs/assets/README.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Autorzy docs, Admin / Frontend |

---

## Struktura (SSOT)

| Ścieżka | Zawartość |
|---------|-----------|
| [live/](./live/) | Zrzuty Live Map (`global.png`, `tenant.png`, `moderator.png`) — opcjonalne, bez PII |
| [../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md](../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md) | Prompty Nano Banana dla assetów mobilnych (Cyklo-Siedlce Grand Prix) + referencja w `docs/design/reference/` |

Historyczne mockupy PNG i diagram architektury **nie są** trzymane w repo na tej gałęzi; manifest archiwalny opisuje je w [archive/ASSET_MANIFEST.json](../archive/ASSET_MANIFEST.json) z adnotacją `archivedPaths`.

**HTML mockupy STITCH (mobile):** [../mockups/](../mockups/) — pliki `*.html` mogą być lokalne (`.gitignore`); indeks: [README.md](../README.md#docsmockups--design-mobile).

---

## Manifest

Kanoniczna lista ścieżek dla CI i audytu: [archive/ASSET_MANIFEST.json](../archive/ASSET_MANIFEST.json) — sekcja `docs` wskazuje wyłącznie na `docs/assets/live/`.
