#!/usr/bin/env python3
"""T94 fail-safe affected-test planner for 4VELO CI.

The planner is deliberately conservative:
- pull requests may use narrower related/domain suites;
- push/schedule use FULL component coverage;
- CI-core, shared/high-blast-radius, migration and unknown runtime changes fail safe to FULL;
- documentation-only changes do not invent runtime work;
- visual governance remains an independent mandatory gate when visual paths change.

It never decides that a changed runtime file is safe to SKIP merely because no
known test was found.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import subprocess
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
VALID_EVENTS = {"pull_request", "push", "schedule"}
RISK_ORDER = {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5}

CI_CORE_PATTERNS = (
    ".github/workflows/**",
    ".github/actions/**",
    "scripts/plan_affected_tests.py",
    "scripts/run_affected_mobile_tests.py",
    "scripts/run_affected_backend_tests.py",
    "scripts/test_plan_affected_tests.py",
    "scripts/test_run_affected_mobile_tests.py",
    "scripts/test_run_affected_backend_tests.py",
    "scripts/check_ci_aggregate.py",
    "scripts/test_ci_aggregate.py",
    "scripts/test_ci_mobile_path_filter.py",
    "scripts/test_ci_visual_path_filter.py",
    "turbo.json",
)

FRONTEND_SHARED_PATTERNS = (
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    "packages/**",
)

INFRA_FULL_PATTERNS = (
    "docker-compose*.yml",
    "docker-compose*.yaml",
    "skaffold*.yaml",
    "k8s/**",
    "infra/**",
)

VISUAL_PATTERNS = (
    "mobile/**",
    "assets/**",
    "docs/design/**",
    "docs/adr/**",
    "docs/pl/design/**",
    "docs/pl/adr/**",
    "docs/TAKEOVER_PLAN_CURRENT.md",
    "packages/tokens/**",
    "scripts/audit-screen-tokens.ts",
    "scripts/validate_mobile_asset_governance.py",
    "scripts/test_validate_mobile_asset_governance.py",
    "scripts/validate_mobile_visual_authority.py",
    "scripts/test_validate_mobile_visual_authority.py",
    "scripts/test_ci_visual_path_filter.py",
)

MOBILE_FULL_PATTERNS = (
    "mobile/package.json",
    "mobile/jest.config.js",
    "mobile/tsconfig.json",
    "mobile/babel.config.js",
    "mobile/metro.config.js",
    "mobile/app.config.js",
    "mobile/app.json",
    "mobile/eas.json",
    "mobile/index.*",
    "mobile/src/navigation/**",
    "mobile/src/state/**",
    "mobile/src/theme/**",
    "mobile/src/design-contract/**",
    "mobile/src/bootstrap/**",
    "mobile/src/services/apiClient.*",
)

MOBILE_MANDATORY = {
    "gps_durability": (
        "mobile/src/services/gps",
        "mobile/src/services/location",
    ),
    "ride_safety": (
        "mobile/src/services/ride",
        "mobile/src/components/RideActionBar",
        "mobile/src/components/RideStatusBar",
        "mobile/src/screens/ActiveRide",
        "mobile/src/screens/RideDashboard",
    ),
    "auth_security": (
        "mobile/src/services/auth",
        "mobile/src/services/socialAuth",
        "mobile/src/screens/Auth",
        "mobile/src/screens/Onboarding",
    ),
    "asset_identity": (
        "mobile/src/assets/",
        "mobile/assets/",
    ),
    "i18n_catalog": (
        "mobile/src/i18n/",
        "mobile/locales/",
    ),
}

BACKEND_FULL_BASENAMES = {
    "models.py",
}
BACKEND_FULL_PREFIXES = (
    "backend/core/",
)
BACKEND_FULL_EXACT = {
    "backend/manage.py",
    "backend/requirements.txt",
    "backend/requirements-dev.txt",
    "backend/pyproject.toml",
}

BACKEND_ACTIVITY_BROAD = {
    "backend/activities/models.py",
    "backend/activities/services.py",
    "backend/activities/views.py",
    "backend/activities/serializers.py",
    "backend/activities/urls.py",
    "backend/activities/tasks.py",
    "backend/activities/signals.py",
    "backend/activities/ssrf.py",
    "backend/activities/models_webhooks.py",
    "backend/activities/serializers_webhooks.py",
    "backend/activities/payments.py",
    "backend/activities/payments_views.py",
}

BENIGN_ROOT_FILES = {
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "LICENSE.md",
}


def _norm(path: str) -> str:
    value = path.strip().replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    return value


def _matches(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatchcase(path, pattern)


def _matches_any(path: str, patterns: Iterable[str]) -> bool:
    return any(_matches(path, pattern) for pattern in patterns)


def _is_mobile_source(path: str) -> bool:
    return path.startswith("mobile/src/") and Path(path).suffix in {".ts", ".tsx", ".js", ".jsx"}


def _is_mobile_test(path: str) -> bool:
    return path.startswith("mobile/__tests__/") and ".test." in Path(path).name


def _is_backend_test(path: str) -> bool:
    if not path.startswith("backend/") or not path.endswith(".py"):
        return False
    name = Path(path).name
    return name.startswith("test_") or "/tests/" in path or name.endswith("_tests.py")


def _risk_max(current: str, candidate: str) -> str:
    return candidate if RISK_ORDER[candidate] > RISK_ORDER[current] else current


def _component() -> dict[str, Any]:
    return {
        "mode": "skip",
        "reasons": [],
        "relatedFiles": [],
        "directTests": [],
        "mandatorySuites": [],
    }


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _set_mode(component: dict[str, Any], mode: str, reason: str) -> None:
    order = {"skip": 0, "related": 1, "domain": 1, "full": 2}
    if order[mode] > order[component["mode"]]:
        component["mode"] = mode
    if reason not in component["reasons"]:
        component["reasons"].append(reason)


def _set_all_full(plan: dict[str, Any], reason: str) -> None:
    for name in ("mobile", "backend", "telemetry", "admin"):
        _set_mode(plan[name], "full", reason)
    plan["risk"] = "R5"
    plan["fullFallback"] = True


def _mark_mobile(plan: dict[str, Any], path: str) -> None:
    mobile = plan["mobile"]
    if _matches_any(path, MOBILE_FULL_PATTERNS):
        _set_mode(mobile, "full", f"high-blast-radius mobile path: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R3")
        return

    if _is_mobile_test(path):
        _set_mode(mobile, "related", f"changed mobile test: {path}")
        _append_unique(mobile["directTests"], path)
    elif _is_mobile_source(path):
        _set_mode(mobile, "related", f"mobile leaf/source change: {path}")
        _append_unique(mobile["relatedFiles"], path)
    elif path.startswith(("mobile/assets/", "mobile/locales/")):
        _set_mode(mobile, "related", f"mobile governed asset/catalog change: {path}")
    else:
        _set_mode(mobile, "full", f"unclassified mobile path fails safe to FULL: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R3")
        return

    for suite, prefixes in MOBILE_MANDATORY.items():
        if any(path.startswith(prefix) for prefix in prefixes):
            _append_unique(mobile["mandatorySuites"], suite)

    # Safety-critical service files get mandatory suites even when Jest's graph
    # would otherwise discover a narrower set.
    lower = path.lower()
    if "gps" in lower:
        _append_unique(mobile["mandatorySuites"], "gps_durability")
        _append_unique(mobile["mandatorySuites"], "ride_safety")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    elif "ride" in lower:
        _append_unique(mobile["mandatorySuites"], "ride_safety")
        plan["risk"] = _risk_max(plan["risk"], "R3")
    elif any(token in lower for token in ("auth", "token", "oauth", "session")):
        _append_unique(mobile["mandatorySuites"], "auth_security")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    else:
        plan["risk"] = _risk_max(plan["risk"], "R1")


def _mark_backend_activities(plan: dict[str, Any], path: str) -> None:
    backend = plan["backend"]
    if path in BACKEND_ACTIVITY_BROAD:
        _set_mode(backend, "full", f"shared/high-blast-radius activities module: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    stem = Path(path).stem.lower()
    _set_mode(backend, "domain", f"activities domain change: {path}")

    if any(token in stem for token in ("durable", "telemetry", "route", "ride_fsm", "pilot_activity")):
        _append_unique(backend["mandatorySuites"], "activity_durability")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    elif stem.startswith(("sim", "simulator")) or "sim_" in stem:
        _append_unique(backend["mandatorySuites"], "simulator_light")
        plan["risk"] = _risk_max(plan["risk"], "R2")
    elif stem.startswith("gpx"):
        _append_unique(backend["mandatorySuites"], "gpx_data")
        plan["risk"] = _risk_max(plan["risk"], "R3")
    elif any(token in stem for token in ("moderation", "heatmap", "admin", "tenant")):
        _append_unique(backend["mandatorySuites"], "tenant_security")
        _append_unique(backend["mandatorySuites"], "rls")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    elif stem.startswith("live_map"):
        _append_unique(backend["mandatorySuites"], "live_map")
        _append_unique(backend["mandatorySuites"], "tenant_security")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    elif stem.startswith("wipe"):
        _append_unique(backend["mandatorySuites"], "data_lifecycle")
        plan["risk"] = _risk_max(plan["risk"], "R4")
    elif "wearable" in stem:
        _append_unique(backend["mandatorySuites"], "wearables")
        plan["risk"] = _risk_max(plan["risk"], "R2")
    else:
        _append_unique(backend["mandatorySuites"], "activities_general")
        plan["risk"] = _risk_max(plan["risk"], "R2")


def _mark_backend(plan: dict[str, Any], path: str) -> None:
    backend = plan["backend"]

    if _is_backend_test(path):
        _set_mode(backend, "domain", f"changed backend test: {path}")
        _append_unique(backend["directTests"], path)
        plan["risk"] = _risk_max(plan["risk"], "R2")
        return

    if "/migrations/" in path:
        _set_mode(backend, "full", f"database migration requires FULL backend coverage: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    if path in BACKEND_FULL_EXACT or any(path.startswith(prefix) for prefix in BACKEND_FULL_PREFIXES):
        _set_mode(backend, "full", f"shared backend infrastructure requires FULL: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    if Path(path).name in BACKEND_FULL_BASENAMES:
        _set_mode(backend, "full", f"backend model change requires FULL: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    if not path.endswith(".py"):
        _set_mode(backend, "full", f"unclassified backend file requires FULL: {path}")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    if path.startswith("backend/activities/"):
        _mark_backend_activities(plan, path)
        return

    if path.startswith("backend/users/"):
        lower = path.lower()
        if any(token in lower for token in ("jwt", "mfa", "rbac", "permissions", "oauth", "pilot_profile")):
            _set_mode(backend, "full", f"auth/RBAC backend change requires FULL: {path}")
            plan["risk"] = _risk_max(plan["risk"], "R4")
            return
        _set_mode(backend, "domain", f"users domain change: {path}")
        _append_unique(backend["mandatorySuites"], "users_domain")
        if any(token in lower for token in ("department", "tenant")):
            _append_unique(backend["mandatorySuites"], "tenant_security")
            _append_unique(backend["mandatorySuites"], "rls")
            plan["risk"] = _risk_max(plan["risk"], "R4")
        elif any(token in lower for token in ("data_lifecycle", "export")):
            _append_unique(backend["mandatorySuites"], "data_lifecycle")
            plan["risk"] = _risk_max(plan["risk"], "R4")
        else:
            plan["risk"] = _risk_max(plan["risk"], "R2")
        return

    if path.startswith("backend/clubs/"):
        _set_mode(backend, "domain", f"clubs domain change: {path}")
        _append_unique(backend["mandatorySuites"], "clubs_domain")
        _append_unique(backend["mandatorySuites"], "tenant_security")
        _append_unique(backend["mandatorySuites"], "rls")
        plan["risk"] = _risk_max(plan["risk"], "R4")
        return

    if path.startswith("backend/rewards/"):
        _set_mode(backend, "domain", f"rewards domain change: {path}")
        _append_unique(backend["mandatorySuites"], "rewards_domain")
        plan["risk"] = _risk_max(plan["risk"], "R3")
        return

    if path.startswith("backend/events/"):
        _set_mode(backend, "domain", f"events domain change: {path}")
        _append_unique(backend["mandatorySuites"], "events_domain")
        plan["risk"] = _risk_max(plan["risk"], "R2")
        return

    _set_mode(backend, "full", f"unknown backend domain fails safe to FULL: {path}")
    plan["risk"] = _risk_max(plan["risk"], "R4")


def _finalize_component_safety(plan: dict[str, Any]) -> None:
    mobile = plan["mobile"]
    if mobile["mode"] == "related" and not (
        mobile["relatedFiles"] or mobile["directTests"] or mobile["mandatorySuites"]
    ):
        _set_mode(mobile, "full", "related mobile plan had no runnable evidence; FULL fallback")
        plan["fullFallback"] = True
        plan["risk"] = _risk_max(plan["risk"], "R3")

    backend = plan["backend"]
    if backend["mode"] == "domain" and not (backend["directTests"] or backend["mandatorySuites"]):
        _set_mode(backend, "full", "domain backend plan had no runnable suite; FULL fallback")
        plan["fullFallback"] = True
        plan["risk"] = _risk_max(plan["risk"], "R4")

    for name in ("mobile", "backend", "telemetry", "admin"):
        component = plan[name]
        component["relatedFiles"] = sorted(set(component["relatedFiles"]))
        component["directTests"] = sorted(set(component["directTests"]))
        component["mandatorySuites"] = sorted(set(component["mandatorySuites"]))


def plan_from_files(changed_files: Iterable[str], event_name: str = "pull_request") -> dict[str, Any]:
    event = event_name or "pull_request"
    files = sorted({_norm(path) for path in changed_files if _norm(path)})
    plan: dict[str, Any] = {
        "schemaVersion": 1,
        "policy": "T94_FAIL_SAFE_AFFECTED_TESTS",
        "event": event,
        "risk": "R0",
        "fullFallback": False,
        "changedFiles": files,
        "visualContractRequired": False,
        "mobile": _component(),
        "backend": _component(),
        "telemetry": _component(),
        "admin": _component(),
        "reasons": [],
    }

    if event not in VALID_EVENTS:
        _set_all_full(plan, f"unsupported CI event {event!r} fails safe to FULL")
        plan["reasons"].append("unsupported event")
        return plan

    if event in {"push", "schedule"}:
        _set_all_full(plan, f"{event} uses broad/full regression by policy")
        plan["reasons"].append("main/nightly policy requires broad/full regression")
        return plan

    for path in files:
        if _matches_any(path, VISUAL_PATTERNS):
            plan["visualContractRequired"] = True

        if _matches_any(path, CI_CORE_PATTERNS):
            _set_all_full(plan, f"CI-core change requires FULL: {path}")
            plan["reasons"].append(f"CI core: {path}")
            continue

        if _matches_any(path, INFRA_FULL_PATTERNS):
            _set_all_full(plan, f"shared infrastructure change requires FULL: {path}")
            plan["reasons"].append(f"infrastructure: {path}")
            continue

        if _matches_any(path, FRONTEND_SHARED_PATTERNS):
            _set_mode(plan["mobile"], "full", f"shared JS/package change: {path}")
            _set_mode(plan["admin"], "full", f"shared JS/package change: {path}")
            plan["risk"] = _risk_max(plan["risk"], "R3")
            continue

        if path.startswith("mobile/"):
            _mark_mobile(plan, path)
            continue

        if path.startswith("backend/"):
            _mark_backend(plan, path)
            continue

        if path.startswith("telemetry/"):
            _set_mode(plan["telemetry"], "full", f"telemetry is pilot-critical: {path}")
            plan["risk"] = _risk_max(plan["risk"], "R4")
            continue

        if path.startswith("admin/"):
            _set_mode(plan["admin"], "full", f"admin change: {path}")
            plan["risk"] = _risk_max(plan["risk"], "R2")
            continue

        if path.startswith(("assets/", "docs/")) or path in BENIGN_ROOT_FILES:
            # Governed independently by docs/visual/asset checks.
            continue

        if path.startswith("scripts/"):
            # Non-CI scripts are covered by scripts-python/audit routing. They do
            # not imply runtime tests unless classified as CI core above.
            plan["risk"] = _risk_max(plan["risk"], "R1")
            continue

        if path.startswith(".github/"):
            # Non-workflow metadata/templates are non-runtime.
            continue

        # Unknown runtime/config surface: conservative repo-wide fallback.
        _set_all_full(plan, f"unknown/unclassified repository path requires FULL: {path}")
        plan["reasons"].append(f"unknown path: {path}")

    _finalize_component_safety(plan)
    return plan


def changed_files_from_git(base_sha: str, head_sha: str, repo_root: Path = REPO_ROOT) -> list[str]:
    if not base_sha or not head_sha:
        raise ValueError("both base and head SHA are required for pull_request planning")
    proc = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMRTUXB", f"{base_sha}...{head_sha}"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "git diff failed")
    return [_norm(line) for line in proc.stdout.splitlines() if _norm(line)]


def build_plan(
    event_name: str,
    base_sha: str = "",
    head_sha: str = "",
    changed_files: Iterable[str] | None = None,
    repo_root: Path = REPO_ROOT,
) -> dict[str, Any]:
    if event_name in {"push", "schedule"}:
        plan = plan_from_files([], event_name)
    elif changed_files is not None:
        plan = plan_from_files(changed_files, event_name)
    else:
        try:
            files = changed_files_from_git(base_sha, head_sha, repo_root)
            plan = plan_from_files(files, event_name)
        except Exception as exc:
            plan = plan_from_files([], event_name)
            _set_all_full(plan, f"planner could not prove a safe diff; FULL fallback: {type(exc).__name__}")
            plan["reasons"].append("diff resolution failed; fail-safe FULL")
    plan["baseSha"] = base_sha
    plan["headSha"] = head_sha
    return plan


def markdown_summary(plan: dict[str, Any]) -> str:
    lines = [
        "## T94 Affected Test Plan",
        "",
        f"- Event: `{plan['event']}`",
        f"- Risk: **{plan['risk']}**",
        f"- Full fallback: **{'YES' if plan['fullFallback'] else 'NO'}**",
        f"- Visual contract required: **{'YES' if plan['visualContractRequired'] else 'NO'}**",
        f"- Changed files: **{len(plan['changedFiles'])}**",
        "",
        "| Component | Mode | Mandatory suites |",
        "| --- | --- | --- |",
    ]
    for name in ("mobile", "backend", "telemetry", "admin"):
        component = plan[name]
        suites = ", ".join(component["mandatorySuites"]) or "—"
        lines.append(f"| {name} | **{component['mode']}** | {suites} |")

    lines.extend(["", "### Why"])
    reasons: list[str] = []
    reasons.extend(plan.get("reasons", []))
    for name in ("mobile", "backend", "telemetry", "admin"):
        reasons.extend(f"{name}: {reason}" for reason in plan[name]["reasons"])
    if not reasons:
        reasons.append("No runtime-impacting changes detected.")
    for reason in reasons:
        lines.append(f"- {reason}")

    if plan["changedFiles"]:
        lines.extend(["", "<details><summary>Changed files</summary>", ""])
        lines.extend(f"- `{path}`" for path in plan["changedFiles"])
        lines.extend(["", "</details>"])
    return "\n".join(lines) + "\n"


def _write_github_outputs(plan: dict[str, Any], path: Path) -> None:
    with path.open("a", encoding="utf-8") as fh:
        fh.write(f"risk={plan['risk']}\n")
        fh.write(f"full_fallback={'true' if plan['fullFallback'] else 'false'}\n")
        fh.write(
            f"visual_contract_required={'true' if plan['visualContractRequired'] else 'false'}\n"
        )
        for name in ("mobile", "backend", "telemetry", "admin"):
            fh.write(f"{name}_mode={plan[name]['mode']}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default=os.environ.get("CI_EVENT_NAME", "pull_request"))
    parser.add_argument("--base", default=os.environ.get("CI_BASE_SHA", ""))
    parser.add_argument("--head", default=os.environ.get("CI_HEAD_SHA", ""))
    parser.add_argument("--changed-files-file")
    parser.add_argument("--output")
    parser.add_argument("--github-output")
    parser.add_argument("--github-summary")
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()

    changed: list[str] | None = None
    if args.changed_files_file:
        changed = Path(args.changed_files_file).read_text(encoding="utf-8").splitlines()

    plan = build_plan(args.event, args.base, args.head, changed)

    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(plan, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if args.github_output:
        _write_github_outputs(plan, Path(args.github_output))

    summary = markdown_summary(plan)
    if args.github_summary:
        with Path(args.github_summary).open("a", encoding="utf-8") as fh:
            fh.write(summary)
    if args.summary:
        print(summary, end="")
    elif not args.output:
        print(json.dumps(plan, indent=2, sort_keys=True))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
