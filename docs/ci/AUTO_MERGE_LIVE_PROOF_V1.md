# Auto-merge live proof

Status: **LIVE VALIDATION**

This document is the low-risk payload for the first production proof of the
4VELO fail-closed auto-merge workflow.

The associated pull request is intentionally limited to documentation and must
contain the exact marker:

`Auto-merge: eligible`

Success criteria are recorded in the linked GitHub Issue. The proof is valid
only if the repository automation, rather than a manual merge API call, performs
the squash merge after the required CI and Kilo Code Review checks are green and
all review threads are resolved.

The resulting pull request and linked Issue are the audit evidence for this
validation.


## Hardened lifecycle proof

A second production proof is executed after #144.

This validation specifically requires all of the following to happen without a
manual merge API call:

- the eligible pull request is squash-merged by the fail-closed workflow;
- its same-repository closing Issue is explicitly closed as `completed`;
- the Project lifecycle can then advance the completed work to `Done`.

The workflow must re-evaluate after the Kubernetes Release Gate and must keep
its repository-wide auto-merge transaction serialized until linked-Issue
closure is complete.
