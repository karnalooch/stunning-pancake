# Overhaul plans

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Product |
| **Last reviewed** | 2026-06-10 |
| **Program status** | **Code complete** — wszystkie checklisty ☑; bramka S0 (prod smoke) = operacyjna |
| **Audience** | Product, admin/mobile developers |
| **canonical_path** | docs/overhaul_plan/README.md |

---

Katalog planów przebudowy doświadczenia użytkownika i paneli administracyjnych. Plany uzupełniają (nie zastępują) roadmapy w [docs/admin/](../admin/).

## Dokumenty

| Dokument | Opis |
|----------|------|
| [GLOBAL_OWNER_EXPERIENCE_OVERHAUL.md](./GLOBAL_OWNER_EXPERIENCE_OVERHAUL.md) | Pełna wizja panelu GLOBAL_OWNER — control plane, governance, revenue, mobile on-call |
| [TENANT_ADMIN_EXPERIENCE_OVERHAUL.md](./TENANT_ADMIN_EXPERIENCE_OVERHAUL.md) | Pełna wizja panelu TENANT_ADMIN — City Command Center, ops inbox, branding, analityka miasta |
| [SPONSOR_EXPERIENCE_OVERHAUL.md](./SPONSOR_EXPERIENCE_OVERHAUL.md) | Pełna wizja portalu sponsora B2B — Command Center, mapa POI, kampanie, analityka ROI, branding, finanse |
| [MODERATOR_PANEL_OVERHAUL.md](./MODERATOR_PANEL_OVERHAUL.md) | Wizja panelu TENANT_MODERATOR — inbox, SLA, trust & safety |
| [USER_PANEL_VISION.md](./USER_PANEL_VISION.md) | Wizja panelu zawodnika (mobile) — ride loop, FAQ parity |

## Macierz: dokument → paczka → owner

| Dokument | Rola | ADMIN_ROADMAP | Owner | Checklist w dokumencie |
|----------|------|---------------|-------|----------------------|
| [SPONSOR_EXPERIENCE_OVERHAUL](./SPONSOR_EXPERIENCE_OVERHAUL.md) | SPONSOR | S1 | Product / Admin Lead | f0–f8 |
| [GLOBAL_OWNER_EXPERIENCE_OVERHAUL](./GLOBAL_OWNER_EXPERIENCE_OVERHAUL.md) | GLOBAL_OWNER | S2 | Platform Operator | f1–f5 |
| [TENANT_ADMIN_EXPERIENCE_OVERHAUL](./TENANT_ADMIN_EXPERIENCE_OVERHAUL.md) | TENANT_ADMIN | S3 | Product / Admin Lead | Fazy A–F |
| [MODERATOR_PANEL_OVERHAUL](./MODERATOR_PANEL_OVERHAUL.md) | TENANT_MODERATOR | S4 | Product / Admin Lead | Fazy 1–4, P0 |
| [USER_PANEL_VISION](./USER_PANEL_VISION.md) | ATHLETE (mobile) | S6 | Product / Mobile Lead | P0–P3 |

**Zasada SSOT:** [ADMIN_ROADMAP](../admin/ADMIN_ROADMAP.md) = kiedy; ten katalog = co i dlaczego; [P1_ROADMAP](../admin/P1_ROADMAP.md) / [P2_ROADMAP](../admin/P2_ROADMAP.md) = jak (pliki, API).

## Powiązane

- [ADMIN_ROADMAP.md](../admin/ADMIN_ROADMAP.md) — unified P0–P2 timeline
- [P1_ROADMAP.md](../admin/P1_ROADMAP.md) — paczki 1–5 (code complete)
- [P2_ROADMAP.md](../admin/P2_ROADMAP.md) — GPX, MFA, forensics
- [UI_AUDIT_2026-06-02.md](../admin/UI_AUDIT_2026-06-02.md) — market-standard gaps
