# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../assets/README.md) |
| **canonical_path** | docs/en/assets/README.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Authors docs, Admin/Frontend |

---

## Structure (SSOT)

| Path | Content |
|---------|-----------|
| [live/](./live/) | Live Map dumps (`global.png`, `tenant.png`, `moderator.png`) - optional, no PII |
| [../../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md](../../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md) | Nano Banana prompts for mobile assets (Cyklo-Siedlce Grand Prix) + reference in `docs/design/reference/` |

Historical PNG mockups and architecture diagram are **not** kept in the repo on this branch; the archive manifest describes them in [archive/ASSET_MANIFEST.json](../../archive/ASSET_MANIFEST.json) with the annotation `archivedPaths`.

**HTML mockups STITCH (mobile):** [../mockups/](../../mockups/) - `*.html` files can be local (`.gitignore`); index: [README.md](../README.md#docsmockups--design-mobile).

---

## Manifesto

Canonical path list for CI and audit: [archive/ASSET_MANIFEST.json](../../archive/ASSET_MANIFEST.json) - the `docs` section only points to `docs/assets/live/`.
