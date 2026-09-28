# Compliance — hub


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-09-28 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/compliance/README.md) |
| **canonical_path** | docs/compliance/README.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Legal / DPO / Release Manager |
| **Last reviewed** | 2026-09-28 |
| **Macierz** | [COMPLIANCE_INDEX.md](./COMPLIANCE_INDEX.md) |
| **Indeks główny** | [../README.md](../README.md) |

---

## Cel

Pakiet dokumentów zgodności dla release publicznego i utrzymania RCP — bez duplikacji checklist technicznych (SSOT: [PRE_RELEASE_VERIFICATION](../operations/PRE_RELEASE_VERIFICATION.md)).

| Dokument | Audience | Opis |
|----------|----------|------|
| [RCP.md](./RCP.md) | DPO / Legal | Roboczy rejestr czynności przetwarzania — stan pre-production |
| [DPIA_PLATFORM_CURRENT.md](./DPIA_PLATFORM_CURRENT.md) | DPO / Legal / Product | Platformowa DPIA i legal NO-GO/GO blockers na 2026-09-28 |
| [AI_ASSISTED_DEVELOPMENT.md](./AI_ASSISTED_DEVELOPMENT.md) | Engineering / Security | Zasady używania ChatGPT/Codex i innych narzędzi AI |
| [RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](./RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) | Release Manager | Gate release OSS/GDPR/ToS + Go/No-Go |
| [MAP_BASEMAP_LICENSING.md](./MAP_BASEMAP_LICENSING.md) | Product / Legal | Licencje map bazowych |

**Przed release publicznym:** [COMPLIANCE_INDEX.md](./COMPLIANCE_INDEX.md) → release package → [operations/PRE_RELEASE_VERIFICATION.md](../operations/PRE_RELEASE_VERIFICATION.md) → [admin/P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md).


> **Current legal baseline:** dla sprzecznych starszych deklaracji (np. „full GDPR compliance” albo finalnych ról administratora) pierwszeństwo ma aktualny RCP i `DPIA_PLATFORM_CURRENT.md`. Nie zastępuje to finalnego review prawnego przed pilotem.
