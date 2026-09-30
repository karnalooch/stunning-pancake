#!/usr/bin/env python3
"""Trusted Gumball broker for heavyweight workflow_dispatch proofs."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ops import github_ops, repository_os

COMMAND_RE = re.compile(
    r"^/gumball\s+proof\s+([a-z0-9][a-z0-9._-]*)(?:\s+(retry|status))?\s*$",
    re.IGNORECASE,
)
SHA40 = re.compile(r"^[0-9a-f]{40}$")
PROOF_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")
FAILED_CONCLUSIONS = {
    "failure",
    "cancelled",
    "timed_out",
    "action_required",
    "stale",
    "skipped",
}
ACTIVE_STATUSES = {"queued", "in_progress", "pending", "waiting", "requested"}

STATUS_COLORS = {
    "requested": "FBCA04",
    "running": "1D76DB",
    "passed": "0E8A16",
    "failed": "D93F0B",
    "deferred": "6A737D",
    "reused": "5319E7",
}
STATUS_DESCRIPTIONS = {
    "requested": "Proof requested but not yet dispatched",
    "running": "Broker-managed proof is queued or running",
    "passed": "Broker-managed proof passed for current PR revision",
    "failed": "Broker-managed proof failed for current PR revision",
    "deferred": "Heavy proof is intentionally deferred by CI cost policy",
    "reused": "Existing successful run/artifact reused for current revision",
}


class BrokerError(RuntimeError):
    pass


def load_policy(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_policy(policy: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    if policy.get("schema_version") != 1:
        problems.append("schema_version must equal 1")

    defaults = policy.get("defaults")
    proofs = policy.get("proofs")
    if not isinstance(defaults, dict):
        problems.append("defaults object is required")
        defaults = {}
    if not isinstance(proofs, dict):
        problems.append("proofs object is required")
        return problems

    allowed_permissions = defaults.get("allowed_permissions")
    if not isinstance(allowed_permissions, list) or not allowed_permissions:
        problems.append("defaults.allowed_permissions must be a non-empty list")

    trusted_actors = defaults.get("trusted_actor_logins", [])
    if not isinstance(trusted_actors, list) or not all(
        isinstance(actor, str) and actor for actor in trusted_actors
    ):
        problems.append("defaults.trusted_actor_logins must be a string list")

    status_template = defaults.get(
        "status_label_template",
        "proof-status:$proof:$status",
    )
    if (
        not isinstance(status_template, str)
        or "$proof" not in status_template
        or "$status" not in status_template
    ):
        problems.append(
            "defaults.status_label_template must include $proof and $status"
        )

    for proof_id, proof in proofs.items():
        prefix = f"proofs.{proof_id}"
        if not PROOF_ID.fullmatch(proof_id):
            problems.append(f"{prefix}: invalid proof id")
            continue
        if not isinstance(proof, dict):
            problems.append(f"{prefix}: expected object")
            continue

        enabled = proof.get("enabled", False)
        workflow = proof.get("workflow")
        if enabled and (not isinstance(workflow, str) or not workflow.endswith((".yml", ".yaml"))):
            problems.append(f"{prefix}: enabled proof requires workflow .yml/.yaml")

        label = proof.get("label")
        if label is not None and (
            not isinstance(label, str) or not label.startswith("proof:")
        ):
            problems.append(f"{prefix}: label must use proof:* namespace")

        cost_class = proof.get("cost_class")
        if cost_class not in {"light", "standard", "heavy"}:
            problems.append(f"{prefix}: cost_class must be light/standard/heavy")

        if not isinstance(proof.get("merge_critical"), bool):
            problems.append(f"{prefix}: merge_critical must be boolean")

        allowed_write_permissions = proof.get("allowed_write_permissions", [])
        if not isinstance(allowed_write_permissions, list) or not all(
            isinstance(permission, str) and permission
            for permission in allowed_write_permissions
        ):
            problems.append(
                f"{prefix}: allowed_write_permissions must be a string list"
            )

        request_input = proof.get("request_id_input")
        inputs = proof.get("inputs")
        if enabled and (not isinstance(request_input, str) or not request_input):
            problems.append(f"{prefix}: request_id_input is required")
        if enabled and not isinstance(inputs, dict):
            problems.append(f"{prefix}: inputs object is required")
            inputs = {}

        if isinstance(inputs, dict):
            request_mappings = [
                key for key, value in inputs.items() if value == "$request_id"
            ]
            sha_mappings = [
                key for key, value in inputs.items() if value == "$sha"
            ]
            if enabled and request_input not in request_mappings:
                problems.append(
                    f"{prefix}: request_id_input must map to $request_id"
                )
            if (
                enabled
                and defaults.get("require_exact_sha_input", True)
                and not sha_mappings
            ):
                problems.append(f"{prefix}: exact $sha input mapping is required")

        artifact_name = proof.get("artifact_name")
        if artifact_name is not None:
            if not isinstance(artifact_name, str) or not artifact_name:
                problems.append(f"{prefix}: artifact_name must be non-empty string")
            elif "$sha" not in artifact_name and "$request_id" not in artifact_name:
                problems.append(
                    f"{prefix}: artifact_name must include $sha or $request_id"
                )

        dispatch_ref = proof.get("dispatch_ref", defaults.get("dispatch_ref", "default"))
        if (
            enabled
            and dispatch_ref != "default"
            and not defaults.get("allow_branch_workflow_definition", False)
        ):
            problems.append(
                f"{prefix}: branch workflow definition disabled; dispatch_ref must be default"
            )

        automatic = proof.get("automatic", {})
        if not isinstance(automatic, dict):
            problems.append(f"{prefix}: automatic must be object")
        elif automatic.get("enabled"):
            required_class = automatic.get("require_ci_class")
            if required_class not in {"light", "standard", "heavy"}:
                problems.append(
                    f"{prefix}: automatic.require_ci_class must be light/standard/heavy"
                )

    return problems


def status_label_name(
    policy: dict[str, Any],
    proof_id: str,
    status: str,
) -> str:
    if status not in STATUS_COLORS:
        raise BrokerError(f"unknown proof status: {status!r}")
    template = str(
        policy.get("defaults", {}).get(
            "status_label_template",
            "proof-status:$proof:$status",
        )
    )
    return template.replace("$proof", proof_id).replace("$status", status)


def make_request_id(proof_id: str, pr_number: int, sha: str) -> str:
    if not PROOF_ID.fullmatch(proof_id):
        raise BrokerError(f"invalid proof id: {proof_id!r}")
    if pr_number < 1:
        raise BrokerError("pull request number must be positive")
    if not SHA40.fullmatch(sha):
        raise BrokerError("exact PR SHA must be a lowercase 40-character SHA")
    compact = proof_id.replace(".", "-").replace("_", "-")
    return f"gb-{compact}-pr{pr_number}-{sha[:12]}"


def parse_comment(body: str) -> tuple[str, str] | None:
    match = COMMAND_RE.fullmatch(body.strip())
    if not match:
        return None
    return match.group(1).lower(), (match.group(2) or "run").lower()


def render_value(
    value: str,
    *,
    proof_id: str,
    pr_number: int,
    branch: str,
    sha: str,
    request_id: str,
) -> str:
    mapping = {
        "$proof": proof_id,
        "$pr_number": str(pr_number),
        "$branch": branch,
        "$sha": sha,
        "$request_id": request_id,
    }
    result = value
    for token, replacement in mapping.items():
        result = result.replace(token, replacement)
    return result


def render_inputs(
    proof_id: str,
    proof: dict[str, Any],
    *,
    pr_number: int,
    branch: str,
    sha: str,
    request_id: str,
) -> dict[str, str]:
    inputs = proof.get("inputs") or {}
    return {
        key: render_value(
            str(value),
            proof_id=proof_id,
            pr_number=pr_number,
            branch=branch,
            sha=sha,
            request_id=request_id,
        )
        for key, value in inputs.items()
    }


def actor_permission(repo: str, token: str, actor: str) -> str:
    encoded = urllib.parse.quote(actor, safe="")
    result = github_ops.request(
        token,
        "GET",
        f"/repos/{repo}/collaborators/{encoded}/permission",
    )
    if not isinstance(result, dict):
        raise BrokerError("collaborator permission lookup returned non-object")
    permission = result.get("permission")
    if not isinstance(permission, str):
        raise BrokerError("collaborator permission missing")
    return permission


def authorize_actor(
    repo: str,
    token: str,
    actor: str,
    policy: dict[str, Any],
) -> str:
    trusted = set(policy["defaults"].get("trusted_actor_logins", []))
    if actor in trusted:
        return "trusted-actor"

    permission = actor_permission(repo, token, actor)
    allowed = set(policy["defaults"].get("allowed_permissions", []))
    if permission not in allowed:
        raise BrokerError(
            f"actor {actor!r} permission {permission!r} is not allowed"
        )
    return permission


def get_pr(repo: str, token: str, pr_number: int) -> dict[str, Any]:
    result = github_ops.request(token, "GET", f"/repos/{repo}/pulls/{pr_number}")
    if not isinstance(result, dict):
        raise BrokerError("pull request lookup returned non-object")
    return result


def get_pr_paths(repo: str, token: str, pr_number: int) -> list[str]:
    rows = github_ops.paginate(token, f"/repos/{repo}/pulls/{pr_number}/files")
    return [row["filename"] for row in rows if isinstance(row.get("filename"), str)]


def resolve_pr_revision(
    repo: str,
    pr: dict[str, Any],
) -> tuple[str, str]:
    head = pr.get("head") or {}
    head_repo = (head.get("repo") or {}).get("full_name")
    if head_repo != repo:
        raise BrokerError(
            "fork PR proof dispatch is blocked because trusted branch inputs "
            "must resolve inside the consumer repository"
        )
    branch = head.get("ref")
    sha = head.get("sha")
    if not isinstance(branch, str) or not branch:
        raise BrokerError("PR head branch missing")
    if not isinstance(sha, str) or not SHA40.fullmatch(sha):
        raise BrokerError("PR head SHA is not an exact lowercase 40-character SHA")
    return branch, sha


def resolve_proof_revision(
    repo: str,
    pr: dict[str, Any],
    *,
    allow_merged: bool,
) -> tuple[str, str]:
    state = str(pr.get("state") or "")
    if state == "open":
        return resolve_pr_revision(repo, pr)

    if state == "closed" and pr.get("merged_at"):
        if not allow_merged:
            raise BrokerError(
                "merged PR proof dispatch requires an explicit trusted request"
            )
        base = pr.get("base") or {}
        branch = base.get("ref")
        sha = pr.get("merge_commit_sha")
        if not isinstance(branch, str) or not branch:
            raise BrokerError("merged PR base branch missing")
        if not isinstance(sha, str) or not SHA40.fullmatch(sha):
            raise BrokerError(
                "merged PR merge_commit_sha is not an exact lowercase 40-character SHA"
            )
        return branch, sha

    if state == "closed":
        raise BrokerError("closed-unmerged PR cannot request proof")

    raise BrokerError(f"unsupported PR state for proof dispatch: {state!r}")


def default_branch(repo: str, token: str) -> str:
    result = github_ops.request(token, "GET", f"/repos/{repo}")
    if not isinstance(result, dict) or not result.get("default_branch"):
        raise BrokerError("repository default branch is unavailable")
    return str(result["default_branch"])


def workflow_path(proof: dict[str, Any]) -> str:
    workflow = str(proof["workflow"])
    if workflow.startswith(".github/workflows/"):
        return workflow
    return f".github/workflows/{workflow}"


def fetch_workflow_text(
    repo: str,
    token: str,
    proof: dict[str, Any],
    trusted_ref: str,
) -> str:
    path = urllib.parse.quote(workflow_path(proof), safe="/")
    ref = urllib.parse.quote(trusted_ref, safe="")
    result = github_ops.request(
        token,
        "GET",
        f"/repos/{repo}/contents/{path}?ref={ref}",
    )
    if not isinstance(result, dict):
        raise BrokerError("workflow content lookup returned non-object")
    if result.get("encoding") != "base64" or not isinstance(result.get("content"), str):
        raise BrokerError("workflow content is not available as base64")
    try:
        return base64.b64decode(result["content"]).decode("utf-8")
    except (ValueError, UnicodeError) as exc:
        raise BrokerError(f"workflow content decode failed: {exc}") from exc


def validate_workflow_contract(
    text: str,
    proof: dict[str, Any],
) -> list[str]:
    problems: list[str] = []
    if "workflow_dispatch:" not in text:
        problems.append("workflow_dispatch trigger is missing")

    request_input = proof.get("request_id_input")
    if isinstance(request_input, str):
        if not re.search(
            rf"(?m)^\s{{4,}}{re.escape(request_input)}:\s*$",
            text,
        ):
            problems.append(f"request-id input {request_input!r} is missing")

        run_name_lines = [
            line for line in text.splitlines() if line.lstrip().startswith("run-name:")
        ]
        expected = f"inputs.{request_input}"
        if not any(expected in line for line in run_name_lines):
            problems.append(
                f"run-name must include {expected} for deterministic dedupe"
            )

    sha_inputs = [
        key for key, value in (proof.get("inputs") or {}).items() if value == "$sha"
    ]
    for input_name in sha_inputs:
        if not re.search(
            rf"(?m)^\s{{4,}}{re.escape(input_name)}:\s*$",
            text,
        ):
            problems.append(f"exact-SHA input {input_name!r} is missing")
        if f"inputs.{input_name}" not in text:
            problems.append(
                f"exact-SHA input {input_name!r} is declared but never referenced"
            )

    if re.search(r"(?m)^\s*permissions:\s*write-all\s*$", text):
        problems.append("target workflow permissions: write-all is forbidden")

    allowed_write = set(proof.get("allowed_write_permissions", []))
    for permission in re.findall(
        r"(?m)^\s{2,}([A-Za-z0-9-]+):\s*write\s*$",
        text,
    ):
        if permission not in allowed_write:
            problems.append(
                f"target workflow write permission {permission!r} is not allow-listed"
            )

    return problems


def artifact_name(
    proof_id: str,
    proof: dict[str, Any],
    *,
    pr_number: int,
    branch: str,
    sha: str,
    request_id: str,
) -> str | None:
    template = proof.get("artifact_name")
    if template is None:
        return None
    return render_value(
        str(template),
        proof_id=proof_id,
        pr_number=pr_number,
        branch=branch,
        sha=sha,
        request_id=request_id,
    )


def find_artifact(
    repo: str,
    token: str,
    name: str,
) -> dict[str, Any] | None:
    encoded = urllib.parse.quote(name, safe="")
    result = github_ops.request(
        token,
        "GET",
        f"/repos/{repo}/actions/artifacts?name={encoded}&per_page=100",
    )
    if not isinstance(result, dict):
        raise BrokerError("artifact lookup returned non-object")
    candidates = [
        item
        for item in result.get("artifacts", [])
        if isinstance(item, dict)
        and item.get("name") == name
        and not item.get("expired")
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: item.get("created_at") or "")


def find_existing_run(
    repo: str,
    token: str,
    proof: dict[str, Any],
    request_id: str,
) -> dict[str, Any] | None:
    filename = Path(str(proof["workflow"])).name
    encoded = urllib.parse.quote(filename, safe="")
    result = github_ops.request(
        token,
        "GET",
        f"/repos/{repo}/actions/workflows/{encoded}/runs"
        "?event=workflow_dispatch&per_page=100",
    )
    if not isinstance(result, dict):
        raise BrokerError("workflow-run lookup returned non-object")

    matching = []
    for run in result.get("workflow_runs", []):
        if not isinstance(run, dict):
            continue
        title = str(run.get("display_title") or run.get("name") or "")
        if request_id in title:
            matching.append(run)
    if not matching:
        return None
    return max(matching, key=lambda item: item.get("created_at") or "")


def dispatch_workflow(
    repo: str,
    token: str,
    proof: dict[str, Any],
    trusted_ref: str,
    inputs: dict[str, str],
) -> None:
    filename = Path(str(proof["workflow"])).name
    encoded = urllib.parse.quote(filename, safe="")
    github_ops.request(
        token,
        "POST",
        f"/repos/{repo}/actions/workflows/{encoded}/dispatches",
        {"ref": trusted_ref, "inputs": inputs},
    )


def rerun_workflow(repo: str, token: str, run_id: int) -> None:
    github_ops.request(
        token,
        "POST",
        f"/repos/{repo}/actions/runs/{run_id}/rerun",
        {},
    )


def ensure_labels(
    repo: str,
    token: str,
    policy: dict[str, Any],
    apply: bool,
) -> list[str]:
    existing = {
        item["name"]: item
        for item in github_ops.paginate(token, f"/repos/{repo}/labels")
    }
    definitions: dict[str, tuple[str, str]] = {}
    for proof_id, proof in policy.get("proofs", {}).items():
        if not isinstance(proof, dict) or not proof.get("enabled"):
            continue
        label = proof.get("label")
        if isinstance(label, str):
            definitions[label] = (
                "8250DF",
                f"Request Gumball proof {proof_id}",
            )
        for status, color in STATUS_COLORS.items():
            status_label = status_label_name(policy, proof_id, status)
            definitions[status_label] = (
                color,
                f"{STATUS_DESCRIPTIONS[status]} ({proof_id})",
            )

    messages: list[str] = []
    for name, (color, description) in sorted(definitions.items()):
        current = existing.get(name)
        if current is None:
            messages.append(f"CREATE label {name}")
            if apply:
                github_ops.request(
                    token,
                    "POST",
                    f"/repos/{repo}/labels",
                    {"name": name, "color": color, "description": description},
                )
            continue
        if (
            str(current.get("color", "")).upper() != color
            or current.get("description") != description
        ):
            messages.append(f"UPDATE label {name}")
            if apply:
                encoded = urllib.parse.quote(name, safe="")
                github_ops.request(
                    token,
                    "PATCH",
                    f"/repos/{repo}/labels/{encoded}",
                    {
                        "new_name": name,
                        "color": color,
                        "description": description,
                    },
                )
    return messages


def set_status_label(
    repo: str,
    token: str,
    pr_number: int,
    policy: dict[str, Any],
    proof_id: str,
    status: str | None,
    apply: bool,
) -> None:
    issue = github_ops.request(token, "GET", f"/repos/{repo}/issues/{pr_number}")
    if not isinstance(issue, dict):
        raise BrokerError("PR issue metadata lookup returned non-object")
    current = [
        label["name"]
        for label in issue.get("labels", [])
        if isinstance(label, dict) and isinstance(label.get("name"), str)
    ]
    owned = {
        status_label_name(policy, proof_id, candidate)
        for candidate in STATUS_COLORS
    }
    target = [label for label in current if label not in owned]
    if status:
        target.append(status_label_name(policy, proof_id, status))
    target = sorted(set(target))
    if apply and sorted(current) != target:
        github_ops.request(
            token,
            "PUT",
            f"/repos/{repo}/issues/{pr_number}/labels",
            {"labels": target},
        )


def ensure_request_label(
    repo: str,
    token: str,
    pr_number: int,
    proof: dict[str, Any],
    apply: bool,
) -> None:
    label = proof.get("label")
    if not isinstance(label, str) or not label:
        return
    if apply:
        github_ops.request(
            token,
            "POST",
            f"/repos/{repo}/issues/{pr_number}/labels",
            {"labels": [label]},
        )


def comment_result(
    repo: str,
    token: str,
    pr_number: int,
    result: dict[str, Any],
    apply: bool,
) -> None:
    if not apply:
        return
    action = result.get("action")
    proof_id = result.get("proof")
    details = result.get("message") or ""
    url = result.get("url")
    lines = [
        f"**Gumball Proof Broker — {action}**",
        "",
        f"Proof: `{proof_id}`",
        f"Request: `{result.get('request_id')}`",
    ]
    if details:
        lines.append(f"Result: {details}")
    if url:
        lines.append(f"Run/artifact: {url}")
    github_ops.request(
        token,
        "POST",
        f"/repos/{repo}/issues/{pr_number}/comments",
        {"body": "\n".join(lines)},
    )


def comment_result_best_effort(
    repo: str,
    token: str,
    pr_number: int,
    result: dict[str, Any],
    apply: bool,
) -> str | None:
    try:
        comment_result(repo, token, pr_number, result, apply)
    except github_ops.GitHubError as exc:
        return (
            "result comment bookkeeping failed; "
            f"proof action {result.get('action')!r} is preserved: {exc}"
        )
    return None


def status_from_existing(
    artifact: dict[str, Any] | None,
    run: dict[str, Any] | None,
) -> tuple[str, str | None]:
    if artifact is not None:
        return "REUSE", "reused"
    if run is None:
        return "MISSING", "requested"

    status = str(run.get("status") or "")
    conclusion = run.get("conclusion")
    if status in ACTIVE_STATUSES:
        return "ALREADY_RUNNING", "running"
    if status == "completed" and conclusion == "success":
        return "REUSE_RUN", "passed"
    if status == "completed" and conclusion in FAILED_CONCLUSIONS:
        return "FAILED_EXISTING", "failed"
    return "UNKNOWN", "requested"


def _run_url(run: dict[str, Any] | None) -> str | None:
    if not isinstance(run, dict):
        return None
    url = run.get("html_url")
    return str(url) if isinstance(url, str) else None


def _artifact_url(artifact: dict[str, Any] | None) -> str | None:
    if not isinstance(artifact, dict):
        return None
    url = artifact.get("archive_download_url")
    return str(url) if isinstance(url, str) else None


def evaluate_proof(
    *,
    repo: str,
    token: str,
    policy: dict[str, Any],
    proof_id: str,
    pr_number: int,
    actor: str | None,
    explicit: bool,
    retry: bool,
    status_only: bool,
    apply: bool,
) -> dict[str, Any]:
    proof = (policy.get("proofs") or {}).get(proof_id)
    if not isinstance(proof, dict) or not proof.get("enabled"):
        raise BrokerError(f"proof {proof_id!r} is not enabled")

    if explicit:
        if not actor:
            raise BrokerError("explicit proof request is missing actor")
        authorize_actor(repo, token, actor, policy)

    pr = get_pr(repo, token, pr_number)
    branch, sha = resolve_proof_revision(
        repo,
        pr,
        allow_merged=explicit,
    )

    if explicit and not status_only and pr.get("state") == "open":
        ensure_request_label(repo, token, pr_number, proof, apply)
    request_id = make_request_id(proof_id, pr_number, sha)

    artifact = None
    artifact_key = artifact_name(
        proof_id,
        proof,
        pr_number=pr_number,
        branch=branch,
        sha=sha,
        request_id=request_id,
    )
    if artifact_key:
        artifact = find_artifact(repo, token, artifact_key)

    run = find_existing_run(repo, token, proof, request_id)
    existing_action, existing_status = status_from_existing(artifact, run)

    base_result = {
        "proof": proof_id,
        "pr_number": pr_number,
        "branch": branch,
        "sha": sha,
        "request_id": request_id,
    }

    if status_only:
        set_status_label(repo, token, pr_number, policy, proof_id, existing_status, apply)
        return {
            **base_result,
            "action": existing_action,
            "message": "status-only query",
            "url": _artifact_url(artifact) or _run_url(run),
        }

    if artifact is not None:
        set_status_label(repo, token, pr_number, policy, proof_id, "reused", apply)
        return {
            **base_result,
            "action": "REUSE",
            "message": f"artifact {artifact_key!r} already exists",
            "url": _artifact_url(artifact),
        }

    if run is not None:
        status = str(run.get("status") or "")
        conclusion = run.get("conclusion")
        if status in ACTIVE_STATUSES:
            set_status_label(repo, token, pr_number, policy, proof_id, "running", apply)
            return {
                **base_result,
                "action": "ALREADY_RUNNING",
                "message": "identical proof request is already queued/running",
                "url": _run_url(run),
            }
        if status == "completed" and conclusion == "success":
            set_status_label(repo, token, pr_number, policy, proof_id, "passed", apply)
            return {
                **base_result,
                "action": "REUSE_RUN",
                "message": "identical proof already succeeded",
                "url": _run_url(run),
            }
        if status == "completed" and conclusion in FAILED_CONCLUSIONS:
            if retry:
                if apply:
                    rerun_workflow(repo, token, int(run["id"]))
                set_status_label(
                    repo, token, pr_number, policy, proof_id, "running", apply
                )
                return {
                    **base_result,
                    "action": "RERUN",
                    "message": f"rerunning existing {conclusion} proof",
                    "url": _run_url(run),
                }
            set_status_label(repo, token, pr_number, policy, proof_id, "failed", apply)
            return {
                **base_result,
                "action": "FAILED_EXISTING",
                "message": "existing proof failed; explicit retry is required",
                "url": _run_url(run),
            }

    paths = get_pr_paths(repo, token, pr_number)
    ci_plan = repository_os.plan_ci(paths)
    automatic = not explicit
    auto_policy = proof.get("automatic") or {}

    if automatic:
        if not auto_policy.get("enabled"):
            return {
                **base_result,
                "action": "SKIP",
                "message": "automatic proof dispatch is disabled",
            }
        required_class = auto_policy.get("require_ci_class")
        if required_class and ci_plan.get("class") != required_class:
            return {
                **base_result,
                "action": "SKIP",
                "message": (
                    f"CI class {ci_plan.get('class')!r} does not match "
                    f"required {required_class!r}"
                ),
            }
        if proof.get("cost_class") == "heavy" and not proof.get("merge_critical"):
            set_status_label(
                repo, token, pr_number, policy, proof_id, "deferred", apply
            )
            return {
                **base_result,
                "action": "DEFER",
                "message": (
                    "automatic non-merge-critical heavy proof deferred by "
                    "CI Cost Governor"
                ),
            }

    trusted_ref = default_branch(repo, token)
    dispatch_ref = proof.get(
        "dispatch_ref",
        policy["defaults"].get("dispatch_ref", "default"),
    )
    if dispatch_ref != "default":
        if not policy["defaults"].get(
            "allow_branch_workflow_definition", False
        ):
            raise BrokerError("branch-local workflow definitions are disabled")
        trusted_ref = render_value(
            str(dispatch_ref),
            proof_id=proof_id,
            pr_number=pr_number,
            branch=branch,
            sha=sha,
            request_id=request_id,
        )

    workflow_text = fetch_workflow_text(repo, token, proof, trusted_ref)
    contract_problems = validate_workflow_contract(workflow_text, proof)
    if contract_problems:
        raise BrokerError(
            "target workflow contract invalid: " + "; ".join(contract_problems)
        )

    inputs = render_inputs(
        proof_id,
        proof,
        pr_number=pr_number,
        branch=branch,
        sha=sha,
        request_id=request_id,
    )
    if apply:
        dispatch_workflow(repo, token, proof, trusted_ref, inputs)

    bookkeeping_warning = None
    try:
        set_status_label(repo, token, pr_number, policy, proof_id, "running", apply)
    except github_ops.GitHubError as exc:
        bookkeeping_warning = (
            "post-dispatch status bookkeeping failed; proof dispatch is preserved: "
            f"{exc}"
        )

    result = {
        **base_result,
        "action": "DISPATCH",
        "message": (
            f"trusted workflow dispatched from {trusted_ref!r}; "
            f"CI class={ci_plan.get('class')}"
        ),
        "input_keys": sorted(inputs),
    }
    if bookkeeping_warning:
        result["warning"] = bookkeeping_warning
    return result


def proof_for_label(
    policy: dict[str, Any],
    label: str,
) -> str | None:
    for proof_id, proof in (policy.get("proofs") or {}).items():
        if isinstance(proof, dict) and proof.get("enabled") and proof.get("label") == label:
            return proof_id
    return None


def label_actor(
    repo: str,
    token: str,
    pr_number: int,
    label: str,
) -> str | None:
    events = github_ops.paginate(
        token,
        f"/repos/{repo}/issues/{pr_number}/events",
    )
    for event in reversed(events):
        if event.get("event") != "labeled":
            continue
        if (event.get("label") or {}).get("name") != label:
            continue
        actor = (event.get("actor") or {}).get("login")
        if isinstance(actor, str):
            return actor
    return None


def reconcile(
    repo: str,
    token: str,
    policy: dict[str, Any],
    apply: bool,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    prs = github_ops.paginate(token, f"/repos/{repo}/pulls?state=open")
    for pr in prs:
        number = int(pr["number"])
        issue = github_ops.request(token, "GET", f"/repos/{repo}/issues/{number}")
        labels = [
            item["name"]
            for item in issue.get("labels", [])
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        ]
        for label in labels:
            proof_id = proof_for_label(policy, label)
            if not proof_id:
                continue
            try:
                result = evaluate_proof(
                    repo=repo,
                    token=token,
                    policy=policy,
                    proof_id=proof_id,
                    pr_number=number,
                    actor=None,
                    explicit=False,
                    retry=False,
                    status_only=True,
                    apply=apply,
                )
            except BrokerError as exc:
                result = {
                    "proof": proof_id,
                    "pr_number": number,
                    "action": "BLOCKED",
                    "message": str(exc),
                }
            results.append(result)
    return results


def handle_event(
    repo: str,
    token: str,
    policy: dict[str, Any],
    event_name: str,
    event: dict[str, Any],
    apply: bool,
) -> list[tuple[dict[str, Any], bool]]:
    """Return (result, should_comment) tuples."""
    results: list[tuple[dict[str, Any], bool]] = []

    if event_name == "issue_comment":
        issue = event.get("issue") or {}
        if "pull_request" not in issue:
            return []
        command = parse_comment(str((event.get("comment") or {}).get("body") or ""))
        if command is None:
            return []
        proof_id, mode = command
        actor = str((event.get("sender") or {}).get("login") or "")
        pr_number = int(issue["number"])
        result = evaluate_proof(
            repo=repo,
            token=token,
            policy=policy,
            proof_id=proof_id,
            pr_number=pr_number,
            actor=actor,
            explicit=True,
            retry=mode == "retry",
            status_only=mode == "status",
            apply=apply,
        )
        results.append((result, True))
        return results

    if event_name == "pull_request_target":
        action = str(event.get("action") or "")
        pr = event.get("pull_request") or {}
        pr_number = int(pr.get("number") or 0)

        if action == "labeled":
            label = str((event.get("label") or {}).get("name") or "")
            proof_id = proof_for_label(policy, label)
            if not proof_id:
                return []
            actor = str((event.get("sender") or {}).get("login") or "")
            result = evaluate_proof(
                repo=repo,
                token=token,
                policy=policy,
                proof_id=proof_id,
                pr_number=pr_number,
                actor=actor,
                explicit=True,
                retry=False,
                status_only=False,
                apply=apply,
            )
            results.append((result, True))
            return results

    if event_name == "repository_dispatch":
        payload = event.get("client_payload") or {}
        proof_id = str(payload.get("proof") or "")
        pr_number = int(str(payload.get("pr_number") or "0"))
        result = evaluate_proof(
            repo=repo,
            token=token,
            policy=policy,
            proof_id=proof_id,
            pr_number=pr_number,
            actor=None,
            explicit=False,
            retry=False,
            status_only=False,
            apply=apply,
        )
        results.append((result, False))
        return results

    if event_name == "workflow_dispatch":
        inputs = event.get("inputs") or {}
        proof_id = str(inputs.get("proof") or "")
        pr_number = int(str(inputs.get("pr_number") or "0"))
        retry = str(inputs.get("retry") or "false").lower() == "true"
        actor = str((event.get("sender") or {}).get("login") or "")
        result = evaluate_proof(
            repo=repo,
            token=token,
            policy=policy,
            proof_id=proof_id,
            pr_number=pr_number,
            actor=actor,
            explicit=True,
            retry=retry,
            status_only=False,
            apply=apply,
        )
        results.append((result, True))
        return results

    return []


def main() -> int:
    parser = argparse.ArgumentParser(prog="gumball-proof-broker")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"))
    parser.add_argument("--policy", default=".gumball/proof-broker.json")
    parser.add_argument("--apply", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("validate")

    event_parser = sub.add_parser("event")
    event_parser.add_argument(
        "--event",
        default=os.environ.get("GITHUB_EVENT_PATH"),
    )
    event_parser.add_argument(
        "--event-name",
        default=os.environ.get("GITHUB_EVENT_NAME"),
    )

    sub.add_parser("reconcile")
    sub.add_parser("labels-sync")

    args = parser.parse_args()
    policy = load_policy(Path(args.policy))
    problems = validate_policy(policy)
    if problems:
        for problem in problems:
            print(f"proof-broker: FAIL - {problem}")
        return 1

    if args.command == "validate":
        print("proof-broker: PASS")
        return 0

    if not args.repo or not args.token:
        print("proof-broker: BLOCKED - repo/token missing", file=sys.stderr)
        return 2

    try:
        if args.command == "labels-sync":
            for message in ensure_labels(
                args.repo, args.token, policy, args.apply
            ):
                print(message)
            return 0

        if args.command == "reconcile":
            reconcile(args.repo, args.token, policy, args.apply)
            print("proof-broker: reconcile complete")
            return 0

        if args.command == "event":
            if not args.event or not args.event_name:
                print(
                    "proof-broker: BLOCKED - event path/name missing",
                    file=sys.stderr,
                )
                return 2
            event = json.loads(Path(args.event).read_text(encoding="utf-8"))
            results = handle_event(
                args.repo,
                args.token,
                policy,
                args.event_name,
                event,
                args.apply,
            )
            for result, should_comment in results:
                warning = result.get("warning")
                if warning:
                    print(f"proof-broker: WARN - {warning}", file=sys.stderr)
                if should_comment and "pr_number" in result:
                    comment_warning = comment_result_best_effort(
                        args.repo,
                        args.token,
                        int(result["pr_number"]),
                        result,
                        args.apply,
                    )
                    if comment_warning:
                        print(
                            f"proof-broker: WARN - {comment_warning}",
                            file=sys.stderr,
                        )
            print("proof-broker: event processed")
            return 0

        raise AssertionError(args.command)
    except BrokerError as exc:
        print(f"proof-broker: BLOCKED - {exc}", file=sys.stderr)
        return 2
    except github_ops.GitHubError as exc:
        print(
            f"proof-broker: BLOCKED - GitHub API request failed before completion: {exc}",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
