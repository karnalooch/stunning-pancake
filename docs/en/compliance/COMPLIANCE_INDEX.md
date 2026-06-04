# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../compliance/COMPLIANCE_INDEX.md) |
| **canonical_path** | docs/en/compliance/COMPLIANCE_INDEX.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Legal / DPO / Release Manager |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Release Manager, Product, Legal |
| **Hub** | [README.md](./README.md) |

---

## Purpose

One compatibility gate table before public release and mapping to operational runbooks (no duplication of checklists).

---

## Matrix

| Document | Language | Audience | When to use |
|----------|-------|----------|--------------|
| [RCP.md](./RCP.md) | EN | DPO / Legal | Register of activities (GDPR) - permanent reference |
| [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | EN | Release Manager | **Gate** before public release (OSS, GDPR, ToS) |
| [MAP_BASEMAP_LICENSING.md](../../compliance/MAP_BASEMAP_LICENSING.md) | EN | Product/Legal | Basemaps (OSM, commercial layers) |

---

## Release procedure (shortcut)

| Step | Role | Action |
|------|------|--------|
| 1 | Release Manager | [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) - Go/No-Go |
| 2 | Release Manager | [operations/PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md) |
| 3 | DPO (if data scope change) | Update [RCP.md](./RCP.md) |
| 4 | Product | Maps: [MAP_BASEMAP_LICENSING.md](../../compliance/MAP_BASEMAP_LICENSING.md) |

---

## Verification

- Checklists in the release package completed and signed (no secrets in the repo).
- Mobile legal flow compliant with RCP - [onboarding/GUIDE.md](../onboarding/GUIDE.md) § Legal.

---

## Related

| Document | Description |
|----------|------|
| [../operations/PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md) | Technical gate CI + smoke |
| [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) | Smoke admin panel |
| [../product/FAQ.md](../product/FAQ.md) | User FAQ (privacy, anti-cheat) |
