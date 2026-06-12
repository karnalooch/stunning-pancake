# Subprocessor list — per-tenant template

| | |
|--|--|
| **Status** | Active — template |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Owner** | DPO / Legal |
| **Tenant** | `[TENANT_NAME]` |
| **lang** | en |
| **translation** | [Polski](../../pl/compliance/SUBPROCESSORS_TEMPLATE.md) |
| **canonical_path** | docs/gtm/en/compliance/SUBPROCESSORS_TEMPLATE.md |
| **DPIA** | [DPIA_TEMPLATE.md](./DPIA_TEMPLATE.md) |

---

## Instructions

1. Copy the table into the DPIA annex or processing agreement.
2. Mark **DPA status**: `Active` / `In progress` / `N/A` (no personal data).
3. Update on any vendor change — notify tenant at least 30 days in advance (standard DPA clause).
4. For commercial maps — see [MAP_BASEMAP_LICENSING.md](../../../compliance/MAP_BASEMAP_LICENSING.md).

---

## Subprocessor table (4VELO default)

| # | Subprocessor | Role | Data processed | Location | DPA status | Notes |
|---|--------------|------|----------------|----------|------------|-------|
| 1 | `[Railway / hosting]` | App hosting, DB, Redis | All platform data | `[USA/EU — complete]` | `[ ]` | Postgres, Redis, Celery workers |
| 2 | `[Email operator]` | Campaign transactional email | Email, name | `[ ]` | `[ ]` | Kickoff, password reset |
| 3 | `[Push provider]` | Mobile push notifications | Device token, notification body | `[ ]` | `[ ]` | FCM / APNs via Expo |
| 4 | OpenStreetMap / tile provider | Basemaps, heatmaps | Location aggregates (no PII in tile layer) | Global CDN | N/A / license | See MAP_BASEMAP_LICENSING |
| 5 | `[Matrix / chat — if enabled]` | Club/event chat | Messages, user ID | `[ ]` | `[ ]` | Optional module |
| 6 | Strava / Garmin (API) | User activity import | OAuth token, activity metadata | USA | User consent | Only when user connects account |
| 7 | `[Stripe — if payments]` | Payments / rewards | Payment data | `[ ]` | `[ ]` | Only with paid rewards module |
| 8 | `[Datadog / monitoring — if prod]` | Metrics, operational logs | Anonymized logs, metrics | `[ ]` | `[ ]` | No PII content in logs |

---

## Tenant-specific subprocessors `[TENANT_NAME]`

| # | Subprocessor | Role | Data | Location | DPA | Notes |
|---|--------------|------|------|----------|-----|-------|
| T1 | `[e.g. tenant HR office]` | Employee participant list | Work email | Poland | `[ ]` | Corporate campaigns only |
| T2 | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

---

## Transfers outside EEA

If a subprocessor processes outside the EEA:

- [ ] Standard Contractual Clauses (SCC) signed
- [ ] Transfer assessment documented
- [ ] Tenant informed in DPIA §5

---

## Change history

| Date | Change | Author |
|------|--------|--------|
| `[DATE]` | Initial version | `[ ]` |

---

## Checklist

- [ ] All active subprocessors from default table verified
- [ ] Tenant-specific rows completed or removed
- [ ] DPA status = Active for each processing PII
- [ ] Annex attached to DPIA and tenant agreement
