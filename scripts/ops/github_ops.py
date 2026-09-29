# Synced from Gumball v0.6.0 (karnalooch/engineering-platform).
#!/usr/bin/env python3
"""GitHub runtime adapter for Gumball repository operations.

Trusted automation only: this script is intended to run from the default branch,
including pull_request_target workflows that never execute untrusted PR code.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ops import repository_os

API = "https://api.github.com"
GRAPHQL = "https://api.github.com/graphql"
CLOSING_REF = re.compile(
    r"(?im)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b"
)

LABEL_COLORS = {
    "type": "1D76DB",
    "area": "5319E7",
    "risk": "D93F0B",
    "ci": "0E8A16",
    "lifecycle": "6A737D",
    "status": "FBCA04",
}


class GitHubError(RuntimeError):
    pass


def _headers(token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gumball-repository-os",
    }


def request(
    token: str,
    method: str,
    path: str,
    payload: dict[str, Any] | list[Any] | None = None,
) -> Any:
    url = path if path.startswith("http") else API + path
    body = None
    headers = _headers(token)
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise GitHubError(f"{method} {url}: HTTP {exc.code}: {detail}") from exc


def graphql(token: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    result = request(token, "POST", GRAPHQL, {"query": query, "variables": variables})
    if not isinstance(result, dict):
        raise GitHubError("GraphQL returned a non-object response")
    if result.get("errors"):
        raise GitHubError("GraphQL error: " + json.dumps(result["errors"]))
    return result.get("data", {})


def paginate(token: str, path: str) -> list[Any]:
    separator = "&" if "?" in path else "?"
    page = 1
    items: list[Any] = []
    while True:
        batch = request(token, "GET", f"{path}{separator}per_page=100&page={page}")
        if not isinstance(batch, list):
            raise GitHubError(f"expected list from {path}")
        items.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return items


def find_build_artifact(
    repo: str,
    token: str,
    fingerprint: str,
) -> dict[str, Any] | None:
    name = repository_os.artifact_name(fingerprint)
    encoded = urllib.parse.quote(name, safe="")
    result = request(
        token,
        "GET",
        f"/repos/{repo}/actions/artifacts?name={encoded}&per_page=100",
    )
    if not isinstance(result, dict):
        raise GitHubError("artifact lookup returned a non-object response")
    artifacts = [
        artifact
        for artifact in result.get("artifacts", [])
        if not artifact.get("expired")
    ]
    if not artifacts:
        return None
    return max(artifacts, key=lambda item: item.get("created_at") or "")


def sync_labels(repo: str, token: str, policy: dict[str, Any], apply: bool) -> list[str]:
    existing = {
        label["name"]: label
        for label in paginate(token, f"/repos/{repo}/labels")
    }
    messages: list[str] = []

    for definition in policy["labels"]["definitions"]:
        name = definition["name"]
        namespace = name.split(":", 1)[0]
        color = LABEL_COLORS.get(namespace, "6A737D")
        description = definition["description"]

        current = existing.get(name)
        if current is None:
            messages.append(f"CREATE label {name}")
            if apply:
                request(
                    token,
                    "POST",
                    f"/repos/{repo}/labels",
                    {"name": name, "color": color, "description": description},
                )
            continue

        if current.get("description") != description or current.get("color", "").upper() != color:
            messages.append(f"UPDATE label {name}")
            if apply:
                encoded = urllib.parse.quote(name, safe="")
                request(
                    token,
                    "PATCH",
                    f"/repos/{repo}/labels/{encoded}",
                    {"new_name": name, "color": color, "description": description},
                )

    return messages


def _pr_files(repo: str, number: int, token: str) -> list[str]:
    files = paginate(token, f"/repos/{repo}/pulls/{number}/files")
    return [item["filename"] for item in files]


def _current_labels(repo: str, number: int, token: str) -> list[str]:
    item = request(token, "GET", f"/repos/{repo}/issues/{number}")
    return [label["name"] for label in item.get("labels", [])]


def _replace_namespace_labels(
    repo: str,
    number: int,
    token: str,
    desired: list[str],
    namespaces: set[str],
    apply: bool,
) -> list[str]:
    current = _current_labels(repo, number, token)
    keep = [
        label
        for label in current
        if label.split(":", 1)[0] not in namespaces
    ]
    target = sorted(set(keep + desired))

    if target == sorted(current):
        return ["labels already match"]

    if apply:
        request(
            token,
            "PUT",
            f"/repos/{repo}/issues/{number}/labels",
            {"labels": target},
        )
    return [f"labels -> {', '.join(target)}"]


def label_pr(
    repo: str,
    number: int,
    token: str,
    policy: dict[str, Any],
    apply: bool,
) -> dict[str, Any]:
    pr = request(token, "GET", f"/repos/{repo}/pulls/{number}")
    paths = _pr_files(repo, number, token)
    result = repository_os.classify_pr(pr.get("title", ""), paths)
    messages = _replace_namespace_labels(
        repo,
        number,
        token,
        result["labels"],
        {"type", "area", "risk", "ci"},
        apply,
    )
    return {"classification": result, "messages": messages}


def _parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def _age_days(value: str | None, now: dt.datetime) -> float:
    parsed = _parse_time(value)
    if parsed is None:
        return 0
    return (now - parsed).total_seconds() / 86400


def gather_snapshot(repo: str, token: str) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc)
    branches = paginate(token, f"/repos/{repo}/branches")
    prs = paginate(token, f"/repos/{repo}/pulls?state=all")
    issues_raw = paginate(token, f"/repos/{repo}/issues?state=open")

    by_branch: dict[str, list[dict[str, Any]]] = {}
    for pr in prs:
        head = pr.get("head", {}).get("ref")
        if head:
            by_branch.setdefault(head, []).append(pr)

    branch_rows: list[dict[str, Any]] = []
    for branch in branches:
        name = branch["name"]
        candidates = by_branch.get(name, [])
        latest = max(
            candidates,
            key=lambda pr: pr.get("updated_at") or "",
            default=None,
        )
        row: dict[str, Any] = {
            "name": name,
            "protected": branch.get("protected", False),
        }
        if latest:
            merged_at = latest.get("merged_at")
            closed_at = latest.get("closed_at")
            event_time = merged_at or closed_at or latest.get("updated_at")
            row["pull_request"] = {
                "number": latest.get("number"),
                "state": latest.get("state"),
                "merged": bool(merged_at),
                "age_hours": _age_days(event_time, now) * 24,
                "age_days": _age_days(event_time, now),
                "labels": [label["name"] for label in latest.get("labels", [])],
            }
        else:
            commit = request(token, "GET", f"/repos/{repo}/commits/{branch['commit']['sha']}")
            row["orphan_age_days"] = _age_days(
                commit.get("commit", {}).get("committer", {}).get("date"),
                now,
            )
        branch_rows.append(row)

    pr_rows = []
    for pr in prs:
        labels = _current_labels(repo, pr["number"], token)
        pr_rows.append(
            {
                "number": pr["number"],
                "state": pr["state"],
                "head": pr.get("head", {}).get("ref"),
                "draft": pr.get("draft", False),
                "inactive_days": _age_days(pr.get("updated_at"), now),
                "labels": labels,
            }
        )

    issue_rows = []
    for issue in issues_raw:
        if "pull_request" in issue:
            continue
        issue_rows.append(
            {
                "number": issue["number"],
                "state": issue["state"],
                "inactive_days": _age_days(issue.get("updated_at"), now),
                "labels": [label["name"] for label in issue.get("labels", [])],
            }
        )

    return {
        "branches": branch_rows,
        "pull_requests": pr_rows,
        "issues": issue_rows,
    }


def apply_lifecycle_actions(
    repo: str,
    token: str,
    actions: list[dict[str, Any]],
    apply: bool,
) -> list[str]:
    messages: list[str] = []
    for action in actions:
        kind = action["action"]
        if kind == "DELETE_BRANCH":
            branch = action["branch"]
            messages.append(f"DELETE branch {branch}")
            if apply:
                encoded = urllib.parse.quote(branch, safe="")
                request(token, "DELETE", f"/repos/{repo}/git/refs/heads/{encoded}")
        elif kind in {"LABEL_STALE_PR", "LABEL_STALE_ISSUE"}:
            number = action["number"]
            messages.append(f"LABEL stale #{number}")
            if apply:
                request(
                    token,
                    "POST",
                    f"/repos/{repo}/issues/{number}/labels",
                    {"labels": ["lifecycle:stale"]},
                )
        elif kind == "CLOSE_STALE_PR":
            number = action["number"]
            messages.append(f"CLOSE stale PR #{number}")
            if apply:
                request(token, "PATCH", f"/repos/{repo}/pulls/{number}", {"state": "closed"})
        elif kind == "CLOSE_STALE_ISSUE":
            number = action["number"]
            messages.append(f"CLOSE stale issue #{number}")
            if apply:
                request(token, "PATCH", f"/repos/{repo}/issues/{number}", {"state": "closed"})
        elif kind == "REPORT_ORPHAN_BRANCH":
            messages.append(f"REPORT orphan branch {action['branch']}")
        else:
            messages.append(f"UNKNOWN lifecycle action {kind}")
    return messages


PROJECT_QUERY = """
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
  organization(login: $login) {
    projectV2(number: $number) {
      id
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
}
"""

CONTENT_ITEMS_QUERY = """
query($id: ID!) {
  node(id: $id) {
    ... on Issue {
      projectItems(first: 50) { nodes { id project { id } } }
    }
    ... on PullRequest {
      projectItems(first: 50) { nodes { id project { id } } }
    }
  }
}
"""


CLOSING_ISSUES_QUERY = """
query($id: ID!) {
  node(id: $id) {
    ... on PullRequest {
      closingIssuesReferences(first: 50) {
        nodes {
          id
          number
          state
          repository { nameWithOwner }
          labels(first: 50) { nodes { name } }
        }
      }
    }
  }
}
"""

PROJECT_ITEMS_QUERY = """
query($project: ID!, $after: String) {
  node(id: $project) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        nodes {
          id
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          content {
            ... on Issue {
              id
              number
              state
              repository { nameWithOwner }
              labels(first: 50) { nodes { name } }
            }
            ... on PullRequest {
              id
              number
              state
              merged
              isDraft
              repository { nameWithOwner }
              labels(first: 50) { nodes { name } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""

ADD_ITEM = """
mutation($project: ID!, $content: ID!) {
  addProjectV2ItemById(input: {projectId: $project, contentId: $content}) {
    item { id }
  }
}
"""

UPDATE_STATUS = """
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $project,
      itemId: $item,
      fieldId: $field,
      value: {singleSelectOptionId: $option}
    }
  ) {
    projectV2Item { id }
  }
}
"""


def _project_metadata(
    token: str,
    owner: str,
    number: int,
    status_field: str,
) -> tuple[str, str, dict[str, str]]:
    data = graphql(token, PROJECT_QUERY.replace('field(name: "Status")', f'field(name: "{status_field}")'), {"login": owner, "number": number})
    container = data.get("user") or data.get("organization")
    if not container or not container.get("projectV2"):
        raise GitHubError(f"Project v2 {owner}#{number} not found")
    project = container["projectV2"]
    field = project.get("field")
    if not field:
        raise GitHubError(f"Project status field {status_field!r} not found")
    options = {option["name"]: option["id"] for option in field.get("options", [])}
    return project["id"], field["id"], options


def _project_item_id(token: str, content_id: str, project_id: str) -> str | None:
    data = graphql(token, CONTENT_ITEMS_QUERY, {"id": content_id})
    node = data.get("node") or {}
    items = (node.get("projectItems") or {}).get("nodes") or []
    for item in items:
        if (item.get("project") or {}).get("id") == project_id:
            return item["id"]
    return None


def _ensure_project_item(
    token: str,
    content_id: str,
    project_id: str,
    apply: bool,
) -> str | None:
    current = _project_item_id(token, content_id, project_id)
    if current or not apply:
        return current
    data = graphql(token, ADD_ITEM, {"project": project_id, "content": content_id})
    return data["addProjectV2ItemById"]["item"]["id"]


def _semantic_option(
    policy: dict[str, Any],
    semantic: str,
    available: dict[str, str],
) -> tuple[str, str] | None:
    names = policy["projects"]["semantic_statuses"].get(semantic, [])
    for name in names:
        if name in available:
            return name, available[name]
    return None


def sync_project_content(
    *,
    content_id: str,
    item_model: dict[str, Any],
    token: str,
    policy: dict[str, Any],
    apply: bool,
) -> str:
    projects = policy["projects"]
    if not projects.get("enabled"):
        return "projects: DISABLED"

    owner = projects.get("owner")
    number = projects.get("number")
    if not owner or not number:
        raise GitHubError("Projects integration enabled but owner/number is missing")

    project_id, field_id, options = _project_metadata(
        token,
        owner,
        int(number),
        projects.get("status_field", "Status"),
    )
    desired = repository_os.desired_project_state(item_model)
    if desired == "unknown":
        return "projects: UNKNOWN item state"

    option = _semantic_option(policy, desired, options)
    if option is None:
        if desired == "blocked":
            return "projects: BLOCKED semantic state has no configured Project option"
        raise GitHubError(f"no Project option configured for semantic state {desired}")

    option_name, option_id = option
    item_id = _ensure_project_item(token, content_id, project_id, apply)
    if item_id is None and not apply:
        return f"projects: PLAN add content and set {option_name}"

    if apply:
        graphql(
            token,
            UPDATE_STATUS,
            {
                "project": project_id,
                "item": item_id,
                "field": field_id,
                "option": option_id,
            },
        )
    return f"projects: {'SET' if apply else 'PLAN'} {option_name}"


def _event_item(event: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    if "pull_request" in event:
        pr = event["pull_request"]
        state = "merged" if pr.get("merged") else pr.get("state")
        return pr["node_id"], {
            "kind": "pull_request",
            "state": state,
            "draft": pr.get("draft", False),
            "labels": [label["name"] for label in pr.get("labels", [])],
        }
    if "issue" in event:
        issue = event["issue"]
        return issue["node_id"], {
            "kind": "issue",
            "state": issue.get("state"),
            "labels": [label["name"] for label in issue.get("labels", [])],
        }
    return None


def _closing_issues_from_pr(
    repo: str,
    token: str,
    pr: dict[str, Any],
) -> list[dict[str, Any]]:
    issues: dict[int, dict[str, Any]] = {}
    try:
        data = graphql(token, CLOSING_ISSUES_QUERY, {"id": pr["node_id"]})
        nodes = (
            ((data.get("node") or {}).get("closingIssuesReferences") or {})
            .get("nodes", [])
        )
        for issue in nodes:
            if (issue.get("repository") or {}).get("nameWithOwner") == repo:
                issues[int(issue["number"])] = issue
    except GitHubError:
        pass

    body = pr.get("body") or ""
    for raw_number in CLOSING_REF.findall(body):
        number = int(raw_number)
        if number in issues:
            continue
        issue = request(token, "GET", f"/repos/{repo}/issues/{number}")
        issues[number] = {
            "id": issue["node_id"],
            "number": issue["number"],
            "state": issue["state"],
            "labels": {"nodes": issue.get("labels", [])},
            "repository": {"nameWithOwner": repo},
        }

    return [issues[number] for number in sorted(issues)]


def project_event(
    repo: str,
    token: str,
    project_token: str | None,
    policy: dict[str, Any],
    event_path: Path,
    apply: bool,
) -> list[str]:
    if not policy["projects"].get("enabled"):
        return ["projects: DISABLED"]
    if not project_token:
        raise GitHubError("Projects integration enabled but GUMBALL_PROJECT_TOKEN is missing")

    event = json.loads(event_path.read_text(encoding="utf-8"))
    result: list[str] = []
    current = _event_item(event)
    if current:
        content_id, model = current
        result.append(
            sync_project_content(
                content_id=content_id,
                item_model=model,
                token=project_token,
                policy=policy,
                apply=apply,
            )
        )

    pr = event.get("pull_request")
    if pr:
        linked_model = {
            "kind": "issue",
            "state": "open",
            "labels": [],
            "linked_pr": {
                "state": "merged" if pr.get("merged") else pr.get("state"),
                "draft": pr.get("draft", False),
            },
        }
        for issue in _closing_issues_from_pr(repo, token, pr):
            linked_model["state"] = str(issue.get("state", "open")).lower()
            linked_model["labels"] = [
                label["name"]
                for label in (issue.get("labels") or {}).get("nodes", [])
            ]
            result.append(
                sync_project_content(
                    content_id=issue["id"],
                    item_model=dict(linked_model),
                    token=project_token,
                    policy=policy,
                    apply=apply,
                )
            )

    return result or ["projects: no supported event content"]



def _semantic_from_project_status(
    policy: dict[str, Any],
    status_name: str | None,
) -> str | None:
    if not status_name:
        return None
    for semantic, names in policy["projects"]["semantic_statuses"].items():
        if status_name in names:
            return semantic
    return None


def project_audit(
    repo: str,
    token: str,
    project_token: str | None,
    policy: dict[str, Any],
    apply: bool,
) -> list[str]:
    projects = policy["projects"]
    if not projects.get("enabled"):
        return ["projects: DISABLED"]
    if not project_token:
        raise GitHubError("Projects integration enabled but GUMBALL_PROJECT_TOKEN is missing")

    owner = projects.get("owner")
    number = projects.get("number")
    if not owner or not number:
        raise GitHubError("Projects integration enabled but owner/number is missing")

    project_id, field_id, options = _project_metadata(
        project_token,
        owner,
        int(number),
        projects.get("status_field", "Status"),
    )

    rows: list[dict[str, Any]] = []
    cursor = None
    while True:
        data = graphql(
            project_token,
            PROJECT_ITEMS_QUERY,
            {"project": project_id, "after": cursor},
        )
        node = data.get("node") or {}
        items = node.get("items") or {}
        rows.extend(items.get("nodes") or [])
        page = items.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")

    messages: list[str] = []
    for row in rows:
        content = row.get("content")
        if not isinstance(content, dict):
            continue
        repository = (content.get("repository") or {}).get("nameWithOwner")
        if repository != repo:
            continue

        typename = "pull_request" if "merged" in content else "issue"
        state = content.get("state", "").lower()
        if typename == "pull_request" and content.get("merged"):
            state = "merged"

        model = {
            "kind": typename,
            "state": state,
            "draft": content.get("isDraft", False),
            "labels": [
                label["name"]
                for label in (content.get("labels") or {}).get("nodes", [])
            ],
        }

        current_name = (row.get("fieldValueByName") or {}).get("name")
        current_semantic = _semantic_from_project_status(policy, current_name)

        if (
            typename == "issue"
            and state == "open"
            and current_semantic == "done"
            and projects.get("close_issue_on_done")
        ):
            messages.append(f"projects: CLOSE issue #{content['number']} from Done")
            if apply:
                request(
                    token,
                    "PATCH",
                    f"/repos/{repo}/issues/{content['number']}",
                    {"state": "closed"},
                )
            continue

        if typename == "issue" and state == "open" and current_semantic in {
            "in_progress",
            "in_review",
        }:
            messages.append(
                f"projects: KEEP issue #{content['number']} in {current_name}"
            )
            continue

        desired = repository_os.desired_project_state(model)
        if desired == "unknown" or desired == current_semantic:
            continue

        option = _semantic_option(policy, desired, options)
        if option is None:
            messages.append(
                f"projects: BLOCKED #{content['number']} missing option for {desired}"
            )
            continue

        option_name, option_id = option
        messages.append(
            f"projects: MOVE #{content['number']} {current_name!r} -> {option_name}"
        )
        if apply:
            graphql(
                project_token,
                UPDATE_STATUS,
                {
                    "project": project_id,
                    "item": row["id"],
                    "field": field_id,
                    "option": option_id,
                },
            )

    return messages or ["projects: MATCH"]


def main() -> int:
    parser = argparse.ArgumentParser(prog="gumball-github-ops")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"))
    parser.add_argument("--policy", default=".gumball/repository-os.json")
    parser.add_argument("--apply", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("labels-sync")

    artifact = sub.add_parser("artifact-find")
    artifact.add_argument("--fingerprint", required=True)

    pr = sub.add_parser("pr-label")
    pr.add_argument("--number", type=int, required=True)

    sub.add_parser("housekeeping")

    project = sub.add_parser("project-event")
    project.add_argument(
        "--event",
        default=os.environ.get("GITHUB_EVENT_PATH"),
    )
    project.add_argument(
        "--project-token",
        default=os.environ.get("GUMBALL_PROJECT_TOKEN"),
    )

    project_audit_parser = sub.add_parser("project-audit")
    project_audit_parser.add_argument(
        "--project-token",
        default=os.environ.get("GUMBALL_PROJECT_TOKEN"),
    )

    args = parser.parse_args()

    if not args.repo or not args.token:
        print("github-ops: BLOCKED - repo/token missing", file=sys.stderr)
        return 2

    policy = repository_os.load_policy(Path(args.policy))

    try:
        if args.command == "labels-sync":
            messages = sync_labels(args.repo, args.token, policy, args.apply)
        elif args.command == "artifact-find":
            artifact = find_build_artifact(args.repo, args.token, args.fingerprint)
            if artifact is None:
                print(json.dumps({"action": "BUILD", "artifact": None}, indent=2))
            else:
                print(json.dumps({
                    "action": "REUSE",
                    "artifact": {
                        "id": artifact.get("id"),
                        "name": artifact.get("name"),
                        "created_at": artifact.get("created_at"),
                        "archive_download_url": artifact.get("archive_download_url"),
                    },
                }, indent=2))
            return 0
        elif args.command == "pr-label":
            result = label_pr(args.repo, args.number, args.token, policy, args.apply)
            print(json.dumps(result, indent=2))
            return 0
        elif args.command == "housekeeping":
            snapshot = gather_snapshot(args.repo, args.token)
            actions = repository_os.lifecycle_plan(snapshot, policy)
            messages = apply_lifecycle_actions(
                args.repo,
                args.token,
                actions,
                args.apply,
            )
        elif args.command == "project-event":
            if not args.event:
                print("projects: BLOCKED - event path missing", file=sys.stderr)
                return 2
            messages = project_event(
                args.repo,
                args.token,
                args.project_token,
                policy,
                Path(args.event),
                args.apply,
            )
        elif args.command == "project-audit":
            messages = project_audit(
                args.repo,
                args.token,
                args.project_token,
                policy,
                args.apply,
            )
        else:
            raise AssertionError(args.command)
    except GitHubError as exc:
        print(f"github-ops: BLOCKED - {exc}", file=sys.stderr)
        return 2

    for message in messages:
        print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
