"""Aggregate CI gate for T22.

Reads the ``needs`` JSON and ``github.event_name`` exposed by the ``aggregate``
job, evaluates the required-job set against ``changes.outputs`` and fails
closed on any unsupported event, missing job, unknown result or skipped
expected job. Reports only the job name, expected state and observed result.
"""

from __future__ import annotations

import json
import os
import sys

VALID_EVENTS = ("pull_request", "push", "schedule")
VALID_RESULTS = ("success", "skipped", "failure", "cancelled")
VALID_OUTPUT_VALUES = ("true", "false")
REQUIRED_OUTPUT_KEYS = (
    "full",
    "workflow",
    "backend",
    "telemetry",
    "mobile",
    "admin",
    "packages",
    "scripts",
    "docs",
)

PATH_EXPECTED = {
    "backend": ("backend", "scripts-python"),
    "telemetry": ("telemetry",),
    "mobile": ("mobile", "security"),
    "admin": ("admin", "audit", "security", "e2e"),
    "packages": ("mobile", "admin", "repo-assets"),
    "scripts": ("scripts-python", "audit"),
    "docs": ("docs-links",),
}
PATH_OUTPUT_KEYS = tuple(PATH_EXPECTED.keys())
FULL_JOBS = (
    "backend",
    "telemetry",
    "mobile",
    "scripts-python",
    "repo-assets",
    "docs-links",
    "admin",
    "audit",
    "security",
    "trivy",
    "e2e",
)


def _validate_event(event_name):
    return event_name in VALID_EVENTS


def _validate_outputs(outputs):
    if not isinstance(outputs, dict):
        return False
    for key in REQUIRED_OUTPUT_KEYS:
        if key not in outputs:
            return False
        if outputs[key] not in VALID_OUTPUT_VALUES:
            return False
    return True


def _job_result(needs, name):
    entry = needs.get(name)
    if not isinstance(entry, dict):
        return None
    result = entry.get("result")
    if result not in VALID_RESULTS:
        return None
    return result


def _expected_set(outputs, event_name):
    if event_name in ("push", "schedule"):
        if outputs.get("full") != "true":
            return None
        return set(FULL_JOBS)
    if event_name == "pull_request":
        if outputs.get("full") == "true" or outputs.get("workflow") == "true":
            return set(FULL_JOBS)
        expected = set()
        for key in PATH_OUTPUT_KEYS:
            if outputs.get(key) == "true":
                expected.update(PATH_EXPECTED[key])
        return expected
    return None


def evaluate(needs, event_name):
    """Return (passed, reasons). reasons is a list of short strings."""
    reasons = []
    if not isinstance(needs, dict):
        return False, ["needs: invalid payload"]
    if not _validate_event(event_name):
        return False, [f"event {event_name!r}: unsupported"]

    changes_result = _job_result(needs, "changes")
    if changes_result is None:
        return False, ["changes: missing or unknown result"]
    if changes_result != "success":
        return False, [f"changes: expected success, got {changes_result}"]

    outputs = needs.get("changes", {}).get("outputs", {})
    if not _validate_outputs(outputs):
        return False, ["changes.outputs: invalid values"]

    expected = _expected_set(outputs, event_name)
    if expected is None:
        return False, ["changes.outputs.full: must be true for push/schedule"]

    for job in expected:
        result = _job_result(needs, job)
        if result is None:
            reasons.append(f"{job}: missing or unknown result")
            continue
        if result != "success":
            reasons.append(f"{job}: expected success, got {result}")

    for job, entry in needs.items():
        if job in expected or job == "changes":
            continue
        if not isinstance(entry, dict):
            reasons.append(f"{job}: unexpected job missing entry")
            continue
        result = entry.get("result")
        if result in ("success", "skipped"):
            continue
        reasons.append(f"{job}: unexpected job got {result}")

    return (not reasons), reasons


def main():
    raw = os.environ.get("CI_NEEDS_JSON", "")
    event_name = os.environ.get("CI_EVENT_NAME", "")
    try:
        needs = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        print("FAIL: needs JSON is not valid JSON", file=sys.stderr)
        return 1

    ok, reasons = evaluate(needs, event_name)
    if ok:
        print("aggregate: PASS")
        return 0

    print("aggregate: FAIL", file=sys.stderr)
    for reason in reasons:
        print(f"  - {reason}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
