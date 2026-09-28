# T28 — Commit-bound security and dependency inventory

**Status:** PASS  
**Date:** 2026-09-28  
**Issue:** #322  
**PR:** #327  
**Exact source head:** `18467e27a1d61fdc74a234c4d5c051647936ec32`  
**Base:** `33dde53e62dfc529f6d3e9032d4e7aeaf28160dd`  
**PR merge candidate executed by default checkout:** `8dd3fd5fad127b53fe69a5d83fe11637ecc06d84`  
**CI:** 4VELO CI/CD Pipeline run #2348 / run id `36408178359`

## Decision

The pre-pilot dependency/security inventory is clean for the scanned candidate. There is no confirmed runtime HIGH/CRITICAL dependency finding that opens T29 or T30.

The previous backend `pip-audit` suppression for `PYSEC-2024-60` was removed before this evidence run. The canonical command now scans without a vulnerability ignore.

## Evidence

| Source | Scope | Result | Classification |
| --- | --- | --- | --- |
| `pip-audit -r backend/requirements.txt` | Backend Python dependency set | **0 known vulnerabilities** | No finding to classify by severity/reachability; no waiver |
| `pnpm audit --audit-level=high` | Full pnpm workspace | **0 known vulnerabilities** | No HIGH/CRITICAL finding; no duplicate/waiver |
| Blocking Trivy filesystem scan | Runtime-oriented backend/Node/telemetry manifests | **0** for `backend/requirements.txt`, `pnpm-lock.yaml`, `telemetry/requirements.txt` | HIGH/CRITICAL gate clean |
| CodeQL Python | First-party Python | **SUCCESS** | No workflow failure/blocker |
| CodeQL JavaScript/TypeScript | First-party JS/TS | **SUCCESS** | No workflow failure/blocker |
| Dependency Review | PR dependency delta | **SUCCESS** | No introduced blocking dependency finding |
| Aggregate CI gate | Required merge signal | **SUCCESS** | Candidate lane green |

Job identities from run #2348:

- Security inventory: `108884250714`;
- Trivy CVE Scan: `108881881659`;
- CodeQL Python: `108881881607`;
- CodeQL JavaScript/TypeScript: `108881881671`;
- Dependency Review: `108881881678`;
- Aggregate CI gate: `108884766898`.

## Runtime / dev / test classification

There are no vulnerability findings to place into runtime, development or test buckets for this candidate.

The blocking Trivy scan explicitly suppresses development/test dependencies and reports the runtime-oriented manifest set clean. The pnpm audit independently reports no known workspace vulnerabilities at the HIGH threshold or above. Backend pip-audit reports no known vulnerabilities at all for the pinned backend requirements.

## Duplicate, reachability and false-positive review

Because the candidate produced zero dependency findings, there are no duplicate advisories or reachability decisions to reconcile.

One historical exception did exist in CI: `--ignore-vuln PYSEC-2024-60`. T28 removes that suppression. The clean post-removal result proves that the pilot decision no longer depends on that waiver.

## T29 / T30 decision

- **T29:** no pre-pilot Backend Python remediation is required from this inventory.
- **T30:** no pre-pilot Node remediation is required from this inventory.

Either tranche must be reopened if a later exact candidate introduces a confirmed runtime HIGH/CRITICAL finding or another concrete release blocker.

## Boundary

This report is commit-bound evidence, not a permanent claim that future dependency states are safe. T58/T92 must continue to run their security gates on the exact later candidate.

The follow-up reconciliation commit that records this report changes only documentation/evidence state; the dependency/code candidate above is the scanned source of truth for T28.
