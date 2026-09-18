# 4VELO — Current Takeover Plan

**Status:** canonical execution index  
**Decision date:** 2026-09-17  
**Rule:** one tranche = one small, reviewable responsibility/PR unless a historical tranche already landed in several small PRs. Tranche IDs are stable identifiers; the explicit execution-order section below is authoritative when a later-added tranche is intentionally pulled forward.

## One plan, not two

The partial takeover is no longer a separate execution plan. It is part of the general takeover and is tracked with the same `Txx` tranche IDs used from the beginning.

For day-to-day work, this is the one file to remember.

Supporting documents remain useful as detailed contracts/evidence, but they do not define a separate queue:

- `TAKEOVER_CLEANUP_PLAN.md` — original detailed T00–T59 cleanup contracts and history;
- `PARTIAL_TAKEOVER_PILOT_PLAN.md` — historical scope/decision record for the shortened route to pilot;
- `P3_PILOT_DATA_SAFETY_AUDIT_2026-09-16.md` — detailed data-safety findings and exit criteria;
- `TAKEOVER_DATA_SAFETY_AND_DR.md` — detailed disaster-recovery/data-safety package when merged;
- design/audit documents — detailed UI contracts.

If any stage label (`P3`, `P4`, `P5`, `PPH`, `P6`) conflicts with a tranche below, the tranche table in this document wins for execution order. Stage labels are only human-friendly milestones.

### Mobile visual authority

For mobile visual implementation, the takeover-era authority is:

1. `docs/design/MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md`;
2. `docs/design/MOBILE_UI_DESIGN_CONTRACT_V1.md` (Frozen UI v1.2);
3. current asset-governance documents.

**All mobile visual/design/art-direction/mockup decisions predating T00 / PR #60 are historical only and cannot override the current freeze.** Old documents may still contain useful functional/safety history, but they are not visual SSOT. T79–T84 must use the current visual authority and protection gates.

## Status vocabulary

- `DONE` — merged to `main` and its repo-side contract is complete.
- `PARTIAL` — meaningful implementation exists, but the tranche still lacks required runtime/owner evidence.
- `PLANNED` — not started as a complete tranche.
- `ACTIVE` — open implementation PR exists.
- `BLOCKED` — the next required action needs the owner or a specific environment.

## How the pilot fits into the general takeover

| Milestone label | Tranches used in the master plan |
| --- | --- |
| Data-safety gate (formerly P3) | existing `T01`, `T05`, `T13`, `T14`, `T16`, `T57` plus `T60–T76` |
| CI affected-test execution foundation (late-added, pulled forward) | `T94` |
| Mobile UI + UX polish (formerly P4) | `T77–T84` |
| Panels & operations (formerly P5) | `T85–T87` |
| Pre-pilot hardening & polish | existing `T28–T30`, `T58`, `T59` plus `T88–T92` |
| Small-group pilot (formerly P6) | `T93` |

This keeps the useful milestone names without creating a second numbering system to remember.

---

# Master tranche register

## T00–T59 — original takeover program

These retain their original IDs. Only statuses/notes below are refreshed where later pilot work produced clear evidence.

| ID | Tranche | Current status | Evidence / note |
| --- | --- | --- | --- |
| T00 | Publish master cleanup plan | DONE | PR #60 |
| T01 | Signing key removal + guard + rotation closure | BLOCKED | Repo-side removal/guard landed in #93; owner still must prove persistent external key and rotate/revoke any previously active exposed value. See T68. |
| T02 | Emergency LLM proxy lockdown | DONE | PR #66 |
| T03 | Tenant destructive simulator authority | DONE | PR #65 |
| T04 | Tenant moderator privilege review | DONE | PR #68 |
| T05 | Telemetry auth (HTTP + WS / activity-scoped token) | DONE | PR #89 |
| T06 | Telemetry read/privacy isolation | PLANNED | Still separate from ingest auth. |
| T07 | MFA mandatory for administrators | DONE | PR #69 |
| T08 | OAuth state enforcement + provider binding | DONE | PR #70 |
| T09 | Tenant webhook admin / SSRF | DONE | PR #71 |
| T10 | Department / moderation / heatmap tenant scope | DONE | PR #72 |
| T11 | Real PostgreSQL RLS enforcement | DONE | PR #83 |
| T12 | B2B billing isolate or disable | PLANNED | Outside core pilot unless endpoint is active; active endpoint must fail closed. |
| T13 | Telemetry packet/batch contract validation | DONE | PR #95 |
| T14 | Telemetry durable ACK lifecycle | DONE | PR #95; pilot mode qualification strengthened by T62. |
| T15 | Telemetry multi-worker broadcast via Redis | PLANNED | Not required for pilot direct-DB ACK path. |
| T16 | Mobile telemetry bearer + WS auth | DONE | PR #89 |
| T17 | Backend startup migrations out of replica | PLANNED | Needed for mature operations / P5 path. |
| T18 | Telemetry schema out of worker startup | PLANNED | Depends on operational rollout design. |
| T19 | True PostGIS pytest backend gate | PLANNED | Pilot-critical when release gate relies on it. |
| T20 | Telemetry integration gate | PLANNED | Pilot-critical integration evidence. |
| T21 | Mobile CI filter + test integrity | DONE | PR #59 |
| T22 | CI path routing + aggregate check | DONE | PR #61 |
| T23 | Fail-closed security gates | PLANNED | Required where security inventory is promoted to release gate. |
| T24 | Docker publish gated by CI | DONE | PR #63 |
| T25 | Quality baseline scripts unified | PLANNED | Full takeover quality cleanup. |
| T26 | Audit scripts truthful | PLANNED | Full takeover quality cleanup. |
| T27 | Dependency manifest ownership + Dependabot | PLANNED | May be pulled forward if T28 remediation needs it. |
| T28 | Security/dependency inventory, commit-bound | PLANNED | Pre-pilot: classify GitHub vulnerability/code-scanning inventory by runtime/dev/test, severity, duplicates, reachability and false positives. |
| T29 | Backend Python runtime remediation | PLANNED | Before pilot only for confirmed runtime HIGH/CRITICAL or another concrete blocker. |
| T30 | Node dependency remediation | PLANNED | Before pilot for confirmed runtime HIGH/CRITICAL; dev-only debt can remain scheduled. |
| T31 | DRF/GIS direction decision + prototype | PLANNED | Post-pilot unless concrete blocker. |
| T32 | Mobile overrides → pnpm root overrides | PLANNED | Post-pilot unless required by dependency remediation. |
| T33 | Expo/EAS canonical configuration + E2E secrets | PARTIAL | Pilot-local profile/build prerequisites landed across #85/#86/#88; broader canonicalization remains. |
| T34 | Firebase gate + platform config safety | PARTIAL | Pilot Firebase-off/platform gating landed across #88/#90; broader release contract remains. |
| T35 | Conservative admin dead-code/export cleanup | PLANNED | Post-pilot cleanup. |
| T36 | Admin MapLibre loader consolidation | PLANNED | Post-pilot cleanup. |
| T37 | Mobile dead-code/dev-deps prune | PLANNED | Post-pilot cleanup. |
| T38 | Token content check + ownership | PLANNED | Post-pilot unless gate requires it. |
| T39 | API client generated canon + drift CI | PLANNED | Pull forward only if pilot API contract needs it. |
| T40 | Decompose activities/admin_views.py | PLANNED | Post-pilot structural cleanup. |
| T41 | Decompose activities/services.py | PLANNED | Post-pilot structural cleanup. |
| T42 | Decompose activities/simulator_state.py | PLANNED | Post-pilot structural cleanup. |
| T43 | Decompose activities/garmin_simulator.py | PLANNED | Post-pilot structural cleanup. |
| T44 | Decompose users/views.py | PLANNED | Post-pilot structural cleanup. |
| T45 | Consolidate test/dev/validation runners | PLANNED | Full takeover quality cleanup. |
| T46 | i18n manifest completeness + lifecycle modes | PLANNED | Non-blocking unless pilot flow exposes a concrete gap. |
| T47 | Dev-command normalization | PLANNED | Absorbed conceptually into DX0 T88–T90 for the pilot path; broader cleanup can continue later. |
| T48 | Configuration & deployment truth | PLANNED | Required operational subset belongs in T87 before pilot. |
| T49 | Home-lab entry integration | PLANNED | Required operational subset belongs in DX0 T88–T90. |
| T50 | ADR identity migration | PLANNED | Documentation cleanup. |
| T51 | Mobile design as-built vs target | PARTIAL | UI audit/design direction now has newer evidence in #91; remaining cleanup is non-blocking. |
| T52 | Admin roadmap/runbook reconciliation | PLANNED | Operational subset is covered by T85–T87. |
| T53 | Reports/archive lifecycle hardening | PLANNED | Post-pilot documentation cleanup. |
| T54 | GTM ownership + claim labelling | PLANNED | Post-pilot. |
| T55 | Documentation navigation + takeover updates | PLANNED | Final docs cleanup after current plan stabilizes. |
| T56 | Orphan investigation | PLANNED | Post-pilot cleanup. |
| T57 | Business-integrity backup/restore + measured RPO/RTO | DONE | Real home-lab drill passed 2026-09-18: encrypted backup → isolated restore → business snapshot/invariant match → restricted-runtime critical-path smoke. Measured RPO 64.397 s / RTO 4.344 s against plan targets 24 h / 4 h. PR #115 contains blocker fixes discovered by the drill. |
| T58 | Home-lab release gate | PLANNED | Must include data-safety evidence and fail closed on missing proof before T59. |
| T59 | Release-candidate declaration | PLANNED | Final pre-pilot declaration after T92 + required gates. |

## T60–T76 — pilot data-safety work added by the partial takeover

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T60 | Define project-wide critical-data ACK invariant + P3 audit | DONE | PR #96, ADR 015 + evidence matrix. |
| T61 | Mobile GPS durability + honest pending finalization | DONE | PR #94. No silent outbox truncation/no-op durability fallback/false finalize success. |
| T62 | Pilot DB-backed telemetry ACK mode | DONE | PR #97. Pilot home lab forces direct DB-backed ACK instead of unproven volatile Redis ACK. |
| T63 | Canonical route reconciliation + durable finalization barrier | DONE | PR #98. Durable telemetry receipts + route rebuild before durable finalize. |
| T64 | Bind activity creation to authenticated tenant | DONE | PR #99. |
| T65 | Fail closed on cross-tenant activity detail/GPX reads | DONE | PR #100. |
| T66 | Prevent public/profile self-service tenant rebinding | DONE | PR #101. |
| T67 | Enforce club tenant isolation | DONE | PR #102. |
| T68 | Signing-key rotation/revocation proof | BLOCKED | OWNER ACTION REQUIRED. Confirm external persistent key; prove old exposed value never active or rotate/revoke it. No secret value in evidence. |
| T69 | Encrypt GPS data at rest on Android | DONE | PR #106. MMKV key is protected through the SecureStore/Keystore path; physical locked/background behavior remains part of T76 evidence. |
| T70 | Audit log append-only/tamper-resistant contract + critical-action coverage | DONE | PR #108. |
| T71 | Central PII/token/GPS log redaction | DONE | PR #109. |
| T72 | Delete/export/retention contract | DONE | PR #110. |
| T73 | Database runtime-role + worker tenant-context hardening | DONE | PR #111. |
| T74 | Critical-write idempotency inventory | DONE | PR #112. Critical retries use durable request identities/constraints where business effects could duplicate. |
| T75 | TLS/transport + backup confidentiality verification | DONE | PR #113. Loopback-only pilot transport plus AES-256-GCM backup confidentiality/retention are repo-gated; no external TLS/provider claim is inferred. |
| T76 | Android/home-lab chaos and restart matrix | PARTIAL | PR #114 prepares a fail-closed physical-device harness/evidence matrix. Final PASS still requires the real Android + home-lab screen-off/offline/kill/restart/commit-response scenarios. |

**Data-safety exit:** repo-side implementation is complete through T76 and T57 runtime recovery evidence is now accepted. Final exit still requires external evidence for T68 (owner signing-key rotation/revocation proof) and T76 (physical Android/home-lab matrix). Already-DONE T57 and T60–T75 are retained as evidence, not reopened mechanically.

## T94 — CI affected-test / risk-tiered selective execution

**Execution position:** immediately after the takeover-era Visual Protection/Asset Governance foundation is merged, and **before T79**. Implementation is active in stacked PR #117. The ID is late-added and therefore numerically higher; this placement is intentional and does not renumber existing tranches.

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T94 | CI affected-test planner + risk-tiered selective execution | ACTIVE | PR CI computes a deterministic base→head change set and selects the smallest safe test set. Mobile uses dependency-aware related Jest tests for low-risk changes plus mandatory suites; backend uses an explicit domain/risk matrix; shared/config/security/navigation/tenant/telemetry/migration/unknown-impact changes fail safe to broader or FULL coverage. Turborepo dependency/cache information may reduce duplicate work but must not become a fail-open oracle. Main/nightly retain broader/full regression. Aggregate CI remains fail-closed. Planner/path/risk/fallback behavior must have table-driven tests, including proof that unknown classifications select FULL rather than SKIP. |

### T94 contract

The goal is **faster PR feedback without reducing regression confidence**.

Required behavior:

1. compute changed files from the PR base SHA to the candidate head SHA;
2. classify changes deterministically by package/domain and risk tier;
3. use dependency/affected information where it is reliable;
4. for safe mobile leaf changes, run Jest related tests (for example `--findRelatedTests`) plus mandatory safety/visual suites;
5. for backend changes, use an explicit domain-to-test-suite map rather than speculative dynamic import analysis;
6. always run mandatory suites for security/auth, tenant isolation, telemetry/ride lifecycle, GPS/offline durability, migrations/schema, navigation/shared contracts and visual governance when their protected area is touched;
7. choose broader/FULL coverage for shared infrastructure, dependency manifests, CI/build configuration or any unknown/unclassified impact;
8. emit a human-readable CI plan showing **why** each suite ran or why FULL was selected;
9. never let an affected-test optimisation weaken `Aggregate CI gate`, release gates or T92 full regression;
10. keep push-to-main/nightly regression broader than PR-selective execution until evidence justifies any later change.
11. reject zero-test mobile execution in blocking CI: no `--passWithNoTests` in CI/baseline/T94 entrypoints, and missing mandatory suite files are a hard failure.

**Fail-safe invariant:** if the planner cannot prove that a narrower test set is safe, it must select **FULL**, never **SKIP**.

## T77–T84 — mobile UI + UX polish

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T77 | Mobile UI audit + freeze global visual direction | DONE | PR #91. Grand Prix Modern contract is the current direction. |
| T78 | Auth + onboarding implementation | DONE | PR #92. Preserve real auth/onboarding behavior; no fake production team data. |
| T79 | Home screen implementation/polish | PLANNED | Frozen UI v1.2. Start with Visual Protection foundation/semantic primitives, then Home; real data, first-use comprehension, loading/empty/error states. |
| T80 | Active Ride screen implementation/polish | PLANNED | Sunlight readability, one-handed controls, truthful GPS/offline/sync state. |
| T81 | Ride Summary implementation/polish | PLANNED | Never present pending/failed finalization as durable success. |
| T82 | History + Activity Detail implementation/polish | PLANNED | Real canonical route/data, sharp functional maps/charts, loading/error states. |
| T83 | Profile + remaining pilot mobile surfaces | PLANNED | Consistent typography/tokens/visual language; no developer placeholders. |
| T84 | Physical Android UI/UX validation | BLOCKED | ENVIRONMENT REQUIRED. Exact pilot build, real data, first-use without explanation, outdoor/readability + one-handed check, 2–3 person dry run if useful. |

UI is not considered complete because screenshots look good. It must be truthful under real error/offline/synchronization states.

## T85–T87 — panels and operations required by the pilot

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T85 | Club Admin pilot path validation/polish | PLANNED | Members, allowed roles, own-club activity review/moderation; tenant-safe end-to-end. |
| T86 | GLOBAL_OWNER pilot path validation/polish | PLANNED | Clubs, administrators, account blocks and existing audit; no new analytics platform. |
| T87 | Pilot operator flow | PLANNED | Required config, migrations, backup/restore operator procedure and operational smoke for exact environment. |

## T88–T92 — pre-pilot hardening & polish

Security inventory work keeps its original IDs `T28–T30`; release gate/RC keeps `T58–T59`. New DX/final-validation work is below.

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T88 | DX0: fix/verify home-lab Compose layering + one canonical startup path | PLANNED | CI executes the same effective startup/config contract developers use. |
| T89 | DX0: doctor/preflight + init/up + dev env/toolchain contract | PLANNED | Fresh machine reports actionable checks; local secrets generated safely; no undocumented magic steps. |
| T90 | DX0: cold-start smoke → `DEV ENV READY` | PLANNED | Migrations, backend, telemetry, admin and required workers verified automatically after clean start. |
| T91 | Final UI validation on exact pilot candidate | BLOCKED | ENVIRONMENT REQUIRED. Repeat critical mobile flow on exact release candidate, real Android and real failure states. |
| T92 | Full pre-pilot regression on exact SHA | PLANNED | P3 failure matrix, core mobile journey, tenant negatives, admin/GLOBAL_OWNER, recovery invariants, security gate and required CI all green. T94 selective PR execution does not replace this full exact-SHA regression. |

Large Node/pnpm major upgrades are **not** automatic pilot blockers. Do them before pilot only when T28–T30 or DX0 proves they are required for security/reproducibility; otherwise schedule after pilot in a dedicated PR with full CI.

## T93 — small-group pilot

| ID | Tranche | Status | Evidence / acceptance |
| --- | --- | --- | --- |
| T93 | Android pilot with small approved tester group | PLANNED | Starts only after T59 declares the exact candidate and no known pilot blocker remains. Collect real ride, sync, usability and operational evidence; decide expand / fix-and-repeat / stop-and-redesign. |

---

# Current pilot execution order

This is the only short sequence worth remembering:

```text
finish data-safety external evidence:
  T68 + T76

CI efficiency foundation:
  merge current Visual Protection / Asset Governance foundation
  T94

UI:
  T79–T84

panels/operations:
  T85–T87

pre-pilot:
  T28 -> T29/T30 only where findings require them
  T88 -> T89 -> T90
  T58
  T91 -> T92
  T59

pilot:
  T93
```

Already-DONE evidence (`T05`, `T13`, `T14`, `T16`, `T60–T67`, `T77`, `T78`) is not repeated unless a concrete regression invalidates it.

# Full takeover after the pilot

A successful pilot does **not** mark the entire takeover complete. Remaining original T00–T59 work stays in this same register. After pilot evidence is reviewed, resume the remaining `PLANNED` tranches by risk/dependency rather than creating another parallel plan.

Typical post-pilot backlog includes structural cleanup, dependency modernization that was not a pilot blocker, dead-code removal, documentation lifecycle work, module decomposition, broader deployment hardening and scale work.

# Working rule

When starting a new task, use the tranche ID from this file in the branch/PR description and report:

1. tranche ID and exact scope;
2. starting `main` SHA;
3. changed files;
4. tests/evidence;
5. remaining blocker, if any;
6. do not mark `DONE` until merge **and** required runtime/owner evidence for that tranche is satisfied.

If you forget where we are, ask only: **“jaka następna transza?”** — this file is the answer.