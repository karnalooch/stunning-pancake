#!/usr/bin/env python3
"""Fail-closed automatic merge for low-risk 4VELO pull requests."""

from __future__ import annotations

import json
import os
import re
import sys
from collections.abc import Iterable
from pathlib import PurePosixPath
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_ROOT = "https://api.github.com"
GRAPHQL_URL = "https://api.github.com/graphql"
ELIGIBLE_MARKER = re.compile(r"(?mi)^Auto-merge:\s*eligible\s*$")
MANUAL_MARKER = re.compile(r"(?mi)^Auto-merge:\s*manual\s*$")
REQUIRED_CHECKS = ("Aggregate CI gate", "Kilo Code Review")

RISKY_PREFIXES = (
    ".github/",
    "scripts/",
    "k8s/",
    "infra/",
    "deploy/",
    "deployment/",
    "helm/",
)
RISKY_EXACT = {
    "AGENTS.md",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "pyproject.toml",
    "version.json",
    "mobile/package.json",
    "mobile/eas.json",
    "mobile/app.config.js",
    "admin/package.json",
}
RISKY_BASENAMES = {
    "package-lock.json",
    "yarn.lock",
    "poetry.lock",
    "Pipfile",
    "Pipfile.lock",
}
RISKY_SEGMENTS = {"migrations", "security", "secrets", "auth", "oauth"}
RISKY_NAME_PREFIXES = ("requirements", "dependabot")


class AutomationError(RuntimeError):
    """Raised when the automation cannot make a safe decision."""


class ApiError(AutomationError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"GitHub API {status}: {message}")
        self.status = status


class GitHubApi:
    def __init__(self, token: str) -> None:
        if not token:
            raise AutomationError("GITHUB_TOKEN is required")
        self._token = token

    def _request(
        self,
        method: str,
        url: str,
        payload: dict[str, Any] | None = None,
        *,
        accept: str = "application/vnd.github+json",
    ) -> tuple[Any, dict[str, str]]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            url,
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": accept,
                "Content-Type": "application/json",
                "User-Agent": "4velo-fail-closed-auto-merge",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw) if raw else None
                headers = {key.lower(): value for key, value in response.headers.items()}
                return data, headers
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
                message = parsed.get("message", exc.reason)
            except json.JSONDecodeError:
                message = exc.reason
            raise ApiError(exc.code, str(message)) from exc
        except URLError as exc:
            raise AutomationError(f"GitHub transport error: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise AutomationError("GitHub returned invalid JSON") from exc

    def rest(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        *,
        query: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, str]]:
        suffix = ""
        if query:
            suffix = "?" + urlencode(query)
        return self._request(method, f"{API_ROOT}{path}{suffix}", payload)

    def graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        data, _headers = self._request(
            "POST",
            GRAPHQL_URL,
            {"query": query, "variables": variables},
        )
        if not isinstance(data, dict):
            raise AutomationError("GraphQL response is not an object")
        errors = data.get("errors")
        if errors:
            messages = "; ".join(
                str(error.get("message", "unknown GraphQL error")) for error in errors
            )
            raise AutomationError(f"GitHub GraphQL error: {messages}")
        result = data.get("data")
        if not isinstance(result, dict):
            raise AutomationError("GraphQL response is missing data")
        return result


def auto_merge_mode(body: str | None) -> str | None:
    text = body or ""
    if MANUAL_MARKER.search(text):
        return "manual"
    if ELIGIBLE_MARKER.search(text):
        return "eligible"
    return None


def is_risky_path(path: str) -> bool:
    normalized = path.strip().lstrip("./")
    lowered = normalized.lower()
    pure = PurePosixPath(normalized)
    parts_lower = {part.lower() for part in pure.parts}
    basename = pure.name

    if normalized in RISKY_EXACT or basename in RISKY_BASENAMES:
        return True
    if any(normalized.startswith(prefix) for prefix in RISKY_PREFIXES):
        return True
    if parts_lower.intersection(RISKY_SEGMENTS):
        return True
    if any(basename.lower().startswith(prefix) for prefix in RISKY_NAME_PREFIXES):
        return True
    if lowered.endswith((".lock", ".pem", ".key", ".p12", ".pfx")):
        return True
    if basename.lower() in {"settings.py", ".env", ".env.example"}:
        return True
    return False


def risky_paths(paths: Iterable[str]) -> list[str]:
    return sorted(path for path in paths if is_risky_path(path))


def latest_check_conclusions(check_runs: Iterable[dict[str, Any]]) -> dict[str, str | None]:
    latest: dict[str, tuple[int, str | None]] = {}
    for run in check_runs:
        name = str(run.get("name", ""))
        run_id = int(run.get("id", 0))
        conclusion = run.get("conclusion")
        previous = latest.get(name)
        if previous is None or run_id > previous[0]:
            latest[name] = (run_id, None if conclusion is None else str(conclusion))
    return {name: value[1] for name, value in latest.items()}


def missing_required_checks(check_runs: Iterable[dict[str, Any]]) -> list[str]:
    conclusions = latest_check_conclusions(check_runs)
    return [
        name
        for name in REQUIRED_CHECKS
        if conclusions.get(name) != "success"
    ]


def has_changes_requested(reviews: Iterable[dict[str, Any]]) -> bool:
    latest_by_reviewer: dict[str, tuple[int, str]] = {}
    for review in reviews:
        user = review.get("user") or {}
        login = str(user.get("login", ""))
        if not login:
            continue
        review_id = int(review.get("id", 0))
        state = str(review.get("state", "")).upper()
        previous = latest_by_reviewer.get(login)
        if previous is None or review_id > previous[0]:
            latest_by_reviewer[login] = (review_id, state)
    return any(state == "CHANGES_REQUESTED" for _review_id, state in latest_by_reviewer.values())


REVIEW_THREADS_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        pageInfo { hasNextPage }
        nodes { isResolved }
      }
    }
  }
}
"""


def unresolved_review_threads(
    api: GitHubApi,
    *,
    owner: str,
    name: str,
    number: int,
) -> int:
    data = api.graphql(
        REVIEW_THREADS_QUERY,
        {"owner": owner, "name": name, "number": number},
    )
    repository = data.get("repository")
    pull_request = repository.get("pullRequest") if repository else None
    if not pull_request:
        raise AutomationError(f"pull request #{number} could not be resolved")
    threads = pull_request.get("reviewThreads", {})
    if threads.get("pageInfo", {}).get("hasNextPage"):
        raise AutomationError(
            f"pull request #{number} has more than 100 review threads; refusing partial review"
        )
    return sum(
        1
        for node in threads.get("nodes", [])
        if not bool(node.get("isResolved"))
    )


def list_open_pull_requests(api: GitHubApi, repository: str) -> list[dict[str, Any]]:
    pulls, _headers = api.rest(
        "GET",
        f"/repos/{repository}/pulls",
        query={"state": "open", "per_page": 100},
    )
    if not isinstance(pulls, list):
        raise AutomationError("open pull request response is not a list")
    if len(pulls) >= 100:
        raise AutomationError("100 open pull requests returned; refusing incomplete scan")
    return pulls


def list_changed_files(
    api: GitHubApi,
    repository: str,
    number: int,
) -> list[str]:
    result: list[str] = []
    for page in range(1, 5):
        files, _headers = api.rest(
            "GET",
            f"/repos/{repository}/pulls/{number}/files",
            query={"per_page": 100, "page": page},
        )
        if not isinstance(files, list):
            raise AutomationError(f"PR #{number} files response is not a list")
        result.extend(str(item["filename"]) for item in files)
        if len(files) < 100:
            return result
    raise AutomationError(f"PR #{number} changes more than 400 files; manual merge required")


def list_reviews(
    api: GitHubApi,
    repository: str,
    number: int,
) -> list[dict[str, Any]]:
    reviews, _headers = api.rest(
        "GET",
        f"/repos/{repository}/pulls/{number}/reviews",
        query={"per_page": 100},
    )
    if not isinstance(reviews, list):
        raise AutomationError(f"PR #{number} reviews response is not a list")
    if len(reviews) >= 100:
        raise AutomationError(f"PR #{number} has 100+ reviews; manual merge required")
    return reviews


def list_check_runs(
    api: GitHubApi,
    repository: str,
    sha: str,
) -> list[dict[str, Any]]:
    payload, _headers = api.rest(
        "GET",
        f"/repos/{repository}/commits/{sha}/check-runs",
        query={"per_page": 100},
    )
    if not isinstance(payload, dict):
        raise AutomationError("check-runs response is not an object")
    total = int(payload.get("total_count", 0))
    if total > 100:
        raise AutomationError(f"{total} check runs found; manual merge required")
    runs = payload.get("check_runs", [])
    if not isinstance(runs, list):
        raise AutomationError("check_runs is not a list")
    return runs


def print_block(number: int, reason: str) -> None:
    print(f"auto-merge: PR #{number} BLOCKED: {reason}")


def evaluate_pull_request(
    api: GitHubApi,
    *,
    repository: str,
    repository_owner: str,
    pr_summary: dict[str, Any],
) -> str:
    number = int(pr_summary["number"])
    mode = auto_merge_mode(pr_summary.get("body"))
    if mode != "eligible":
        return "not-eligible"

    pr, _headers = api.rest("GET", f"/repos/{repository}/pulls/{number}")
    if not isinstance(pr, dict):
        raise AutomationError(f"PR #{number} payload is not an object")

    if auto_merge_mode(pr.get("body")) != "eligible":
        print_block(number, "eligible marker was removed or manual marker is present")
        return "blocked"
    if pr.get("state") != "open":
        return "not-open"
    if bool(pr.get("draft")):
        print_block(number, "PR is still draft")
        return "blocked"
    if pr.get("base", {}).get("ref") != "main":
        print_block(number, "base branch is not main")
        return "blocked"
    if pr.get("head", {}).get("repo", {}).get("full_name") != repository:
        print_block(number, "head repository is not the protected repository")
        return "blocked"
    if pr.get("user", {}).get("login") != repository_owner:
        print_block(number, "PR author is not repository owner")
        return "blocked"

    paths = list_changed_files(api, repository, number)
    risky = risky_paths(paths)
    if risky:
        preview = ", ".join(risky[:8])
        suffix = "" if len(risky) <= 8 else f" (+{len(risky) - 8} more)"
        print_block(number, f"high-risk paths: {preview}{suffix}")
        return "blocked"

    head_sha = str(pr.get("head", {}).get("sha", ""))
    if not head_sha:
        raise AutomationError(f"PR #{number} has no head SHA")

    missing_checks = missing_required_checks(
        list_check_runs(api, repository, head_sha)
    )
    if missing_checks:
        print_block(number, "required checks not green: " + ", ".join(missing_checks))
        return "blocked"

    reviews = list_reviews(api, repository, number)
    if has_changes_requested(reviews):
        print_block(number, "latest human review contains CHANGES_REQUESTED")
        return "blocked"

    repo_owner, repo_name = repository.split("/", 1)
    unresolved = unresolved_review_threads(
        api,
        owner=repo_owner,
        name=repo_name,
        number=number,
    )
    if unresolved:
        print_block(number, f"{unresolved} unresolved review thread(s)")
        return "blocked"

    mergeable = pr.get("mergeable")
    mergeable_state = str(pr.get("mergeable_state", "unknown"))
    if mergeable is not True:
        print_block(number, f"GitHub mergeable={mergeable!r}")
        return "blocked"

    if mergeable_state == "behind":
        api.rest(
            "PUT",
            f"/repos/{repository}/pulls/{number}/update-branch",
            {"expected_head_sha": head_sha},
        )
        print(f"auto-merge: PR #{number} UPDATED from main; waiting for fresh checks")
        return "updated"

    if mergeable_state != "clean":
        print_block(number, f"mergeable_state={mergeable_state!r}, expected 'clean'")
        return "blocked"

    result, _headers = api.rest(
        "PUT",
        f"/repos/{repository}/pulls/{number}/merge",
        {
            "sha": head_sha,
            "merge_method": "squash",
            "commit_title": f"{pr.get('title', '').strip()} (#{number})",
        },
    )
    if not isinstance(result, dict) or not bool(result.get("merged")):
        message = result.get("message", "merge rejected") if isinstance(result, dict) else "merge rejected"
        raise AutomationError(f"PR #{number} merge was rejected: {message}")

    print(f"auto-merge: PR #{number} MERGED via squash")
    return "merged"


def main() -> int:
    try:
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        repository_owner = os.environ.get("REPOSITORY_OWNER", "")
        token = os.environ.get("GITHUB_TOKEN", "")
        if "/" not in repository:
            raise AutomationError("GITHUB_REPOSITORY must be owner/name")
        if not repository_owner:
            raise AutomationError("REPOSITORY_OWNER is required")

        api = GitHubApi(token)
        pulls = list_open_pull_requests(api, repository)
        eligible = [
            pr for pr in pulls if auto_merge_mode(pr.get("body")) == "eligible"
        ]
        print(f"auto-merge: evaluating {len(eligible)} eligible open PR(s)")
        for pr in eligible:
            evaluate_pull_request(
                api,
                repository=repository,
                repository_owner=repository_owner,
                pr_summary=pr,
            )
        return 0
    except (AutomationError, KeyError, TypeError, ValueError) as exc:
        print(f"auto-merge: FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
