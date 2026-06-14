# Mobile Fix-Forward Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / On-call |
| **Last reviewed** | 2026-06-14 |
| **Audience** | On-call, mobile engineers, QA, release |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md) |
| **canonical_path** | docs/en/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md |
| **Related** | [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) · [MOBILE.md](./MOBILE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Purpose

Safe procedure for shipping mobile regression fixes after merge/release without chaotic hotfix behavior.

Model: **detect → triage → isolate → patch → verify → communicate → follow-up**.

---

## 1) Incident classes and reaction SLA

| Class | Example | Response SLA | Hotfix SLA |
|-------|---------|--------------|------------|
| P0 | startup crash, cannot start ride, telemetry loss | 15 min | 2-4h |
| P1 | deep link broken, incorrect summary, map unavailable | 30 min | 8h |
| P2 | UI drift, copy mismatch, single-screen fallback issue | 1h | 24-48h |

---

## 2) Mandatory triage template

Every incident must include:

1. **Impact:** users affected and critical function impacted.
2. **Scope:** platform (iOS/Android), build version, conditions.
3. **Repro steps:** smallest reliable scenario.
4. **Suspected area:** module/file/feature.
5. **Rollback vs fix-forward decision**.

No patch starts without those five points.

---

## 3) Decision tree: rollback or fix-forward

## Rollback when:

- P0 and no confident root cause in under 60 minutes.
- startup/auth/ride lifecycle is broadly impacted and no safe guard patch exists.

## Fix-forward when:

- root cause is identified,
- patch scope is local,
- fast verification path exists (unit + smoke + manual repro).

---

## 4) Fix-forward procedure

1. **Freeze scope:** patch only root cause + minimal side effects.
2. **Add reproducing test** (whenever possible).
3. **Implement patch** in the smallest change set.
4. **Local verification:**
   - lint on touched files,
   - tests for affected domain,
   - smoke flow for incident scenario.
5. **Patch notes:** what failed, what changed, what intentionally did not change.
6. **Deploy + monitor** for an explicit observation window.

---

## 5) Minimal validation sets by domain

| Domain | Minimum validation |
|--------|--------------------|
| Auth/session | login/register + restore session + logout |
| Ride lifecycle | start/pause/resume/stop + summary |
| GPS durability | recovery banner + resend after reconnect |
| Navigation | stack/tabs transitions + critical deep links |
| Explore/marketplace | entry/exit + network failure fallback |
| Profile/training | history load + activity detail |

---

## 6) Incident communication

## Internal team updates

- status update every 30-60 minutes,
- ETA for next update,
- explicit rollback vs fix-forward call.

## Stakeholder updates

- business impact phrasing,
- mitigation status,
- ETA for full resolution.

---

## 7) Post-incident follow-up (within 24h)

After shipping a fix:

1. add a regression test,
2. update relevant runbook,
3. document prevention opportunity (missing quality gate/check),
4. decide whether additional hardening work is required.

---

## 8) Frequent regression sources (watchlist)

- drift between `types.ts` and `linking.ts`,
- one-language-only i18n updates,
- new release hardcoded URL fallback,
- missing edge-state handling for API errors,
- large screen refactors without legacy adapters,
- inconsistent UI tokens and local hardcoded styles.

---

## 9) Hotfix PR template

## Incident
- ID:
- Severity:
- Trigger version:

## Root cause
- ...

## Scope
- Files changed:
- Why this is minimal:

## Verification
- Tests:
- Smoke:
- Manual repro:

## Risk
- Potential side effects:
- Rollback plan:

## Docs updated
- ...
