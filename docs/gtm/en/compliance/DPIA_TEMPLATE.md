# DPIA Template — 4VELO campaign per tenant

| | |
|--|--|
| **Status** | Active — template |
| **Version** | 1.0 |
| **Date** | 2026-06-12 |
| **Owner** | DPO / Legal |
| **Audience** | Local government, company, league organizer |
| **lang** | en |
| **translation** | [Polski](../../pl/compliance/DPIA_TEMPLATE.md) |
| **canonical_path** | docs/gtm/en/compliance/DPIA_TEMPLATE.md |
| **Subprocessors** | [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) |

---

## How to complete per tenant

1. Replace all `[...]` placeholders with tenant-specific data.
2. Complete [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) and attach as annex.
3. Consult with the administrator's DPO and the platform operator (4VELO).
4. Sign before campaign publication and first participant registration.
5. Store signed version outside the repository (do not commit personal data).

---

## 1. Processing identification

| Field | Value |
|-------|-------|
| **Processing name** | 4VELO sports campaign — `[CAMPAIGN_NAME]` |
| **Tenant / administrator** | `[TENANT_NAME]` — `[CITY/COMPANY]` |
| **Platform operator** | `[4VELO_OPERATOR_NAME]` |
| **Campaign period** | `[START_DATE]` — `[END_DATE]` |
| **DPIA date** | `[DPIA_DATE]` |
| **Version** | 1.0 |

**GDPR roles:** Data controller = `[TENANT_NAME]` (purposes and campaign scope). Processor = 4VELO platform operator (hosting, anti-cheat, leaderboards). Joint controllership — if applicable — describe in §8.

---

## 2. Processing description

### Purposes

| Purpose | Description |
|---------|-------------|
| Campaign / league operation | Registration, leaderboards, inter-department/club challenges |
| Activity verification | GPS tracking, anti-cheat, score normalization |
| Participant communication | Push notifications, campaign email, verification status |
| Decision-maker reporting | km stats, participation, heatmaps (anonymized aggregates) |

### Data subjects

- Employees / residents / club members participating in the campaign.
- Tenant moderators and administrators.
- Optionally: guests via invite (link/code).

### Data categories

| Category | Examples | Sensitivity |
|----------|----------|-------------|
| Identifiers | Email, username, account ID | Standard |
| Location | GPS track, privacy zones (home masking) | Elevated |
| Health / fitness | Height, weight, age (if provided), heart rate (optional) | Special categories — consent only |
| Technical | Device ID, app logs, IP | Standard |

Campaign disciplines: **cycling, running, nordic walking** only.

---

## 3. Legal bases (GDPR)

| Purpose | Basis (Art. 6 GDPR) | Notes |
|---------|---------------------|-------|
| Campaign participation, leaderboard | lit. b — contract / campaign rules | Campaign rules mandatory |
| Anti-cheat, security | lit. f — legitimate interest | Interest in fair results |
| Campaign marketing (optional) | lit. a — consent | Separate consent, withdrawable |
| Biometric / health data | lit. a — explicit consent (Art. 9) | Only if collected |

---

## 4. Necessity and proportionality

| Question | Answer |
|----------|--------|
| Is GPS necessary for the purpose? | Yes — verification of outdoor sports activity |
| Can precision be limited? | Yes — privacy zones, aggregated heatmaps |
| Retention period | Account data: campaign period + `[X]` months; raw logs: max 90 days |
| Moderator access | Limited to anti-cheat cases and support |

---

## 5. Risk assessment

| Risk | Likelihood | Impact | Mitigations | Residual |
|------|------------|--------|-------------|----------|
| Disclosure of precise home location | Medium | High | Privacy zones, masking, no public tracks in zone | Low |
| False cheating accusation | Low | Medium | Appeal process, moderation without public accusations | Low |
| Subprocessor data breach | Low | High | DPA, subprocessor list, encryption in transit | Low |
| Processing outside EEA | Medium | Medium | SCC / hosting DPA, transfer documentation | Medium |
| Profiling without consent | Low | Medium | Normalization without solely automated decisions on individuals | Low |

---

## 6. Technical and organizational measures

- TLS encryption in transit; database encryption at rest (hosting).
- RBAC in admin panel; moderation decision audit log.
- 4-layer anti-cheat — [ANTI_CHEAT_SCORING_POLICY.md](../trust/ANTI_CHEAT_SCORING_POLICY.md).
- Account deletion / anonymization procedure after campaign end.
- Incidents: notify administrator and supervisory authority within GDPR timelines.

---

## 7. Data subject rights

Participants have rights to: access, rectification, erasure, restriction, portability (where applicable), objection, consent withdrawal. Contact: `[TENANT_DPO_EMAIL]`.

---

## 8. Joint controllership (optional)

If `[TENANT_NAME]` and 4VELO operator jointly control:

| Element | Tenant | 4VELO operator |
|---------|--------|----------------|
| Campaign purposes | ✓ | — |
| Infrastructure, anti-cheat | — | ✓ |
| Contact point for individuals | `[EMAIL]` | `[OPERATOR_EMAIL]` |
| Joint controllership agreement | Annex `[AGREEMENT_REF]` | |

---

## 9. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tenant DPO | | | |
| Tenant representative | | | |
| Platform operator | | | |

---

## Pre-signature checklist

- [ ] Placeholders completed
- [ ] [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) attached and current
- [ ] Campaign rules aligned with [CAMPAIGN_RULES_TEMPLATE.md](../campaign-start/CAMPAIGN_RULES_TEMPLATE.md)
- [ ] User Privacy Policy / ToS updated
- [ ] DPA with platform operator signed
- [ ] Signed version archived (outside repo)
