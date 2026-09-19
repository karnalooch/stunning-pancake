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
