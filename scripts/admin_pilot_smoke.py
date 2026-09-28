#!/usr/bin/env python3
"""Run commit-bound T85/T86 admin role smoke against the intended pilot environment."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "backups" / "home-lab" / "evidence"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

ROLE_ENV = {
    "TENANT_ADMIN": ("ADMIN_USER_TENANT_ADMIN", "ADMIN_PASS_TENANT_ADMIN"),
    "GLOBAL_OWNER": ("ADMIN_USER_GLOBAL_OWNER", "ADMIN_PASS_GLOBAL_OWNER"),
}

MANUAL_OBSERVATIONS = {
    "TENANT_ADMIN": [
        "user registry visibly reflects the authenticated tenant",
        "forbidden delete and privileged-role controls are absent",
        "permitted lower-role management and tenant moderation complete without avoidable 403s",
    ],
    "GLOBAL_OWNER": [
        "cross-tenant user visibility is correct for at least two pilot tenants",
        "platform-wide club visibility is correct",
        "current GLOBAL_OWNER has no self lock/delete/bulk destructive actions",
        "a disposable user promoted to GLOBAL_OWNER ends with no tenant membership",
        "ordinary management of another user works without avoidable 403 or validation errors",
    ],
}


def capture(command: list[str]) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def normalize_admin_url(raw: str | None) -> str:
    if not raw:
        raise SystemExit("ADMIN_URL is required; refusing to guess the pilot admin target")

    parsed = urlsplit(raw.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SystemExit("ADMIN_URL must be an absolute http(s) URL")
    if parsed.username or parsed.password:
        raise SystemExit("ADMIN_URL must not contain credentials")
    if parsed.query or parsed.fragment:
        raise SystemExit("ADMIN_URL must not contain a query string or fragment")

    path = parsed.path.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def selected_roles(scope: str) -> list[str]:
    if scope == "t85":
        return ["TENANT_ADMIN"]
    if scope == "t86":
        return ["GLOBAL_OWNER"]
    return ["TENANT_ADMIN", "GLOBAL_OWNER"]


def require_role_credentials(roles: list[str], env: dict[str, str]) -> None:
    missing: list[str] = []
    usernames: list[str] = []

    for role in roles:
        user_name, pass_name = ROLE_ENV[role]
        username = env.get(user_name, "").strip()
        password = env.get(pass_name, "")
        if not username:
            missing.append(user_name)
        if not password:
            missing.append(pass_name)
        if username:
            usernames.append(username)

    if missing:
        raise SystemExit(
            "Missing required pilot role credential environment variables: "
            + ", ".join(sorted(missing))
        )

    if len(roles) > 1 and len(usernames) != len(set(usernames)):
        raise SystemExit("TENANT_ADMIN and GLOBAL_OWNER must use distinct pilot accounts")


def assert_exact_checkout(expected_sha: str) -> str:
    expected = expected_sha.strip().lower()
    if not SHA_RE.fullmatch(expected):
        raise SystemExit("--expected-sha must be the full 40-character Git commit SHA")

    actual = capture(["git", "rev-parse", "HEAD"]).lower()
    if actual != expected:
        raise SystemExit(f"Exact checkout mismatch: expected {expected}, checked out {actual}")

    dirty = capture(["git", "status", "--porcelain"])
    if dirty:
        raise SystemExit(
            "Pilot admin smoke requires a clean checkout so evidence maps to one exact commit"
        )
    return actual


def validate_smoke_report(
    report: dict[str, object],
    *,
    required_roles: list[str],
    admin_url: str,
) -> tuple[bool, list[str], dict[str, dict[str, object]]]:
    reasons: list[str] = []
    base = str(report.get("base", "")).rstrip("/")
    if base != admin_url.rstrip("/"):
        reasons.append(f"report target mismatch: expected {admin_url}, got {base or '<missing>'}")

    raw_results = report.get("results")
    if not isinstance(raw_results, list):
        return False, [*reasons, "role smoke report is missing results"], {}

    by_role: dict[str, dict[str, object]] = {}
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        if isinstance(role, str):
            by_role[role] = item

    selected: dict[str, dict[str, object]] = {}
    for role in required_roles:
        item = by_role.get(role)
        if item is None:
            reasons.append(f"{role}: result missing")
            continue
        selected[role] = item
        if item.get("skipped") is True:
            reasons.append(f"{role}: skipped")
            continue
        if item.get("pass") is not True:
            reasons.append(f"{role}: smoke failed")

    return not reasons, reasons, selected


def write_evidence(
    *,
    git_commit: str,
    admin_url: str,
    roles: list[str],
    smoke_exit_code: int,
    smoke_report: dict[str, object] | None,
    automated_pass: bool,
    failure_reasons: list[str],
) -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    target = EVIDENCE_DIR / f"t85-t86-admin-smoke-{stamp}.json"

    role_results: dict[str, object] = {}
    if isinstance(smoke_report, dict):
        raw_results = smoke_report.get("results", [])
        if isinstance(raw_results, list):
            for item in raw_results:
                if isinstance(item, dict) and item.get("role") in roles:
                    safe_item = {
                        "role": item.get("role"),
                        "skipped": item.get("skipped"),
                        "pass": item.get("pass"),
                        "reason": item.get("reason"),
                        "failures": item.get("failures", []),
                    }
                    role_results[str(item["role"])] = safe_item

    report = {
        "schema_version": 1,
        "gate": "t85-t86-pilot-admin-role-smoke",
        "scope": "automated_role_smoke_only",
        "overall_status": "PASS" if automated_pass else "FAIL",
        "git_commit": git_commit,
        "git_checkout_clean": True,
        "admin_url": admin_url,
        "roles_required": roles,
        "smoke_exit_code": smoke_exit_code,
        "role_results": role_results,
        "failure_reasons": failure_reasons,
        "manual_observations_required_before_tranche_done": {
            role: MANUAL_OBSERVATIONS[role] for role in roles
        },
        "completion_semantics": (
            "Automated PASS proves the exact-SHA role smoke only. "
            "T85/T86 remain PARTIAL until the documented real-environment observations are recorded."
        ),
        "completed_at_utc": datetime.now(UTC).isoformat(),
    }
    target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return target


def run_operator(expected_sha: str, scope: str) -> Path:
    roles = selected_roles(scope)
    env = dict(os.environ)
    admin_url = normalize_admin_url(env.get("ADMIN_URL"))
    require_role_credentials(roles, env)
    commit = assert_exact_checkout(expected_sha)

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    raw_report = EVIDENCE_DIR / f".p0-role-smoke-{os.getpid()}.json"
    raw_report.unlink(missing_ok=True)

    # Keep the role smoke deterministic: inherited credentials for optional or
    # unrequested roles must not turn this gate into a different test matrix.
    for name in (
        "ADMIN_USER",
        "ADMIN_PASS",
        "ADMIN_USER_MODERATOR",
        "ADMIN_PASS_MODERATOR",
        "ADMIN_USER_SPONSOR",
        "ADMIN_PASS_SPONSOR",
    ):
        env.pop(name, None)
    for role, names in ROLE_ENV.items():
        if role not in roles:
            for name in names:
                env.pop(name, None)

    env["ADMIN_URL"] = admin_url
    env["P0_SMOKE_REPORT"] = str(raw_report)

    smoke = subprocess.run(
        ["pnpm", "--filter", "admin", "smoke:p0"],
        cwd=ROOT,
        env=env,
        check=False,
    )

    parsed: dict[str, object] | None = None
    reasons: list[str] = []
    automated_pass = False

    if raw_report.is_file():
        try:
            decoded = json.loads(raw_report.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            reasons.append("role smoke produced invalid JSON")
        else:
            if isinstance(decoded, dict):
                parsed = decoded
                report_ok, report_reasons, _ = validate_smoke_report(
                    decoded,
                    required_roles=roles,
                    admin_url=admin_url,
                )
                reasons.extend(report_reasons)
                automated_pass = report_ok and smoke.returncode == 0
            else:
                reasons.append("role smoke report root must be an object")
    else:
        reasons.append("role smoke did not produce a report")

    if smoke.returncode != 0:
        reasons.append(f"role smoke command exited with code {smoke.returncode}")

    evidence = write_evidence(
        git_commit=commit,
        admin_url=admin_url,
        roles=roles,
        smoke_exit_code=smoke.returncode,
        smoke_report=parsed,
        automated_pass=automated_pass,
        failure_reasons=sorted(set(reasons)),
    )
    raw_report.unlink(missing_ok=True)

    print(
        f"T85/T86 automated admin role smoke {'PASS' if automated_pass else 'FAIL'}: "
        f"commit={commit[:12]}…, roles={','.join(roles)}"
    )
    print(f"Evidence written: {evidence}")

    if not automated_pass:
        raise SystemExit(1)
    return evidence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--expected-sha",
        required=True,
        help="full 40-character pilot candidate SHA that must equal the current clean checkout",
    )
    parser.add_argument(
        "--scope",
        choices=("both", "t85", "t86"),
        default="both",
        help="role smoke scope; default runs both T85 and T86",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_operator(args.expected_sha, args.scope)


if __name__ == "__main__":
    main()
