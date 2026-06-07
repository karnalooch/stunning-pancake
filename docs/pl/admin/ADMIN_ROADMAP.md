# Panel admin — zunifikowana roadmapa (SSOT)


| | |
|--|--|
| **Status** | Active |
| **Owner role** | Admin / Frontend Lead |
| **Last reviewed** | 2026-06-07 |
| **Audience** | Deweloperzy admin, Release Manager, Platform Operator |
| **lang** | pl |
| **translation** | [English](../../admin/ADMIN_ROADMAP.md) |
| **canonical_path** | docs/pl/admin/ADMIN_ROADMAP.md |

---

Jedna oś czasu łącząca wszystkie dokumenty planowania panelu admin. Szczegóły w linkowanych plikach.

**Indeks:** [ADMIN_INDEX.md](./ADMIN_INDEX.md)

---

## Nazewnictwo

| Termin | Znaczenie |
|--------|-----------|
| **Paczka N** | Sekwencja produktowa P1 ([P1_ROADMAP.md](./P1_ROADMAP.md)) |
| **Roadmapa P2** | Tor równoległy: GPX F1–F6 + Auth/MFA ([P2_ROADMAP.md](./P2_ROADMAP.md)) — **nie** Paczka 2 Sponsor |
| **UI Audit P0–P3** | Priorytety ze snapshotu ([UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md)) |
| **ROADMAP_V3** | Architektura długoterminowa + premium faza 2 ([ROADMAP_V3.md](./ROADMAP_V3.md)) |

---

## Gdzie jesteśmy (2026-06-07)

| Kamień milowy | Status |
|---------------|--------|
| Zamknięcie P0 (kod) | Done — weryfikacja prod: [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) |
| Paczka 1a | Done |
| Paczka 1b rdzeń | Done |
| Brama operacyjna | W toku — smoke ról + stabilność kolejki routing |
| Paczka 2 Sponsor | Następny produkt (po bramie) |

---

## Kolejność wykonania

### S0 — Brama operacyjna (teraz)

Kryteria z [P1_ROADMAP.md](./P1_ROADMAP.md) §2 + skrypt `admin/scripts/p0-role-smoke.mjs`.

### S1 — Paczka 2 Sponsor

Nav (Dashboard, POI, Vouchery, Analityka), empty states z CTA, API scoped do tenanta sponsora.

### S2 — Paczka 3 GO tooling

Health strip, drill-down tenant z tabeli na Dashboard.

### S3 — Paczka 4 Tenant Admin

Dashboard scoped, departamenty.

### S4 — Paczka 5 Moderator

Unified inbox, Anti-Cheat depth, GPX w case.

### S5 — P2 Auth + GPX F2–F5

MFA dla GLOBAL_OWNER; archiwum GPX, RODO ZIP (F1 done).

### Później — ROADMAP_V3 premium §7

AI Coach · Voucher 3D · portal ESG.

---

## Ścieżka release

1. [PRE_RELEASE_VERIFICATION.md](../../operations/PRE_RELEASE_VERIFICATION.md)
2. [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) → **GO**
3. [RAILWAY_PRODUCTION_CHECKLIST.md](../../operations/RAILWAY_PRODUCTION_CHECKLIST.md)
4. Kolejna paczka wg tabeli powyżej
