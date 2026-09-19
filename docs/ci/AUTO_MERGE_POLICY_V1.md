# Fail-closed auto-merge policy

Status: **ACTIVE / LIVE HARDENING**  
Scope: routine pull requests targeting `main`

## Goal

Routine low-risk 4VELO changes should merge automatically after CI and code review, without weakening branch protection or extending auto-merge to high-risk repository changes.

Auto-merge is intentionally **opt-in and independently verified**.

## PR marker

A low-risk PR may contain the exact line:

`Auto-merge: eligible`

A PR that must remain manual should contain:

`Auto-merge: manual`

If both markers are present, manual wins.

The marker is not sufficient by itself. The workflow independently re-checks repository, author, changed paths, review state, required gates and mergeability.

## Required conditions

All conditions must hold:

1. PR is open, non-draft and targets `main`.
2. PR head is from `karnalooch/stunning-pancake`, never a fork.
3. PR author is repository owner `karnalooch`.
4. Exact `Auto-merge: eligible` marker is present and no manual marker is present.
5. No changed path is classified high-risk.
6. Latest `Aggregate CI gate` is `success`.
7. Latest `Kilo Code Review` is `success`.
8. No reviewer's latest review is `CHANGES_REQUESTED`.
9. No unresolved review threads exist.
10. The PR links at least one same-repository closing Issue through GitHub closing references.
11. GitHub reports the PR mergeable against current `main`.

If the PR is only behind `main`, the workflow uses GitHub's normal update-branch operation and waits for fresh checks. It never force-pushes.

Merge method is squash.

## High-risk changes

Manual merge remains mandatory for at least:

- GitHub Actions/workflow/action code;
- repository automation scripts;
- `AGENTS.md` and merge policy;
- Kubernetes, Docker, deployment and infrastructure;
- secrets, auth, OAuth and security paths;
- database migrations;
- dependency manifests, lockfiles and requirements;
- private-key/certificate material.

The implementation is deliberately conservative. A false positive means a manual merge, not a risky automatic merge.

## Security model

The privileged workflow uses `pull_request_target` only as a metadata trigger. It **never checks out or executes PR-head code**.

It checks out the repository default branch explicitly with persisted checkout credentials disabled and executes only the already-merged `scripts/auto_merge.py`. The token grants `issues: write` only so the workflow can close same-repository Issues already discovered through `closingIssuesReferences` after a successful merge.

The workflow also re-evaluates on completion of the normal CI pipeline, the Kubernetes Release Gate, and relevant external check runs. Listening to both pipeline completions avoids a race where Aggregate CI and Kilo are green while release-gate checks still leave GitHub mergeability temporarily `unstable`. GitHub branch protection remains the final authority; the workflow contains no bypass path.

## Agent behavior

Agents may add `Auto-merge: eligible` only after reviewing the changed-file set and confirming that the PR is routine and outside all high-risk categories. Uncertainty means `Auto-merge: manual`.

Auto-merge policy changes themselves are always manual.

## Bootstrap and live proof

The PR that introduces this policy must be merged manually because the policy does not yet exist on `main` and its changed paths are high-risk.

Bootstrap #139 is merged. The first live proof (#142) demonstrated a real automatic squash merge but also exposed two lifecycle races: re-evaluation after the release gate and linked-Issue closure. After the hardening PR, validate again on a separate low-risk PR:

1. mark it `Auto-merge: eligible`;
2. make it Ready for review;
3. verify CI and Kilo both pass;
4. verify the automation either updates from `main` and waits for fresh checks or squash-merges directly;
5. verify the linked Issue closes and Project reaches `Done`.
