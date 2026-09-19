#!/usr/bin/env python3
"""Synchronize 4VELO GitHub Project status from pull-request lifecycle events."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GRAPHQL_URL = "https://api.github.com/graphql"
SUPPORTED_ACTIONS = {"opened", "reopened", "converted_to_draft", "ready_for_review"}


class AutomationError(RuntimeError):
    """Raised when project status automation cannot complete safely."""


class GraphQLClient:
    def __init__(
        self,
        token: str,
        opener: Callable[..., Any] | None = None,
    ) -> None:
        if not token:
            raise AutomationError("GH_TOKEN is required")
        self._token = token
        self._opener = opener or urlopen

    def execute(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")
        request = Request(
            GRAPHQL_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
                "User-Agent": "4velo-project-status-automation",
            },
            method="POST",
        )
        try:
            with self._opener(request, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise AutomationError(
                f"GitHub GraphQL HTTP {exc.code}: {exc.reason}"
            ) from exc
        except URLError as exc:
            raise AutomationError(f"GitHub GraphQL transport error: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise AutomationError("GitHub GraphQL returned invalid JSON") from exc

        errors = result.get("errors")
        if errors:
            messages = "; ".join(str(error.get("message", "unknown error")) for error in errors)
            raise AutomationError(f"GitHub GraphQL error: {messages}")

        data = result.get("data")
        if not isinstance(data, dict):
            raise AutomationError("GitHub GraphQL response is missing data")
        return data


def target_status(action: str, is_draft: bool) -> str:
    if action not in SUPPORTED_ACTIONS:
        raise AutomationError(f"unsupported pull_request action: {action}")
    if action == "ready_for_review":
        return "In review"
    if action == "converted_to_draft":
        return "In progress"
    return "In progress" if is_draft else "In review"


def choose_project(owner_data: dict[str, Any], title: str) -> dict[str, Any]:
    owner = owner_data.get("user")
    if not owner:
        raise AutomationError("project owner user could not be resolved")

    nodes = owner.get("projectsV2", {}).get("nodes", [])
    matches = [project for project in nodes if project.get("title") == title]

    if not matches:
        raise AutomationError(f"project not found: {title}")
    if len(matches) > 1:
        numbers = ", ".join(str(project.get("number")) for project in matches)
        raise AutomationError(f"multiple projects named {title!r}; numbers: {numbers}")
    return matches[0]


def choose_status_field(
    fields_data: dict[str, Any],
    desired_status: str,
) -> tuple[str, str]:
    project = fields_data.get("node")
    if not project:
        raise AutomationError("project node is unavailable")

    fields = project.get("fields", {}).get("nodes", [])
    status_fields = [
        field
        for field in fields
        if field.get("__typename") == "ProjectV2SingleSelectField"
        and field.get("name") == "Status"
    ]
    if len(status_fields) != 1:
        raise AutomationError(
            f"expected one Status single-select field, found {len(status_fields)}"
        )

    status_field = status_fields[0]
    options = [
        option
        for option in status_field.get("options", [])
        if option.get("name") == desired_status
    ]
    if len(options) != 1:
        raise AutomationError(
            f"expected one Status option named {desired_status!r}, found {len(options)}"
        )
    return str(status_field["id"]), str(options[0]["id"])


def same_repo_closing_issues(
    pull_request_data: dict[str, Any],
    repository: str,
) -> list[dict[str, Any]]:
    repository_node = pull_request_data.get("repository")
    if not repository_node or not repository_node.get("pullRequest"):
        raise AutomationError("pull request could not be resolved")

    pull_request = repository_node["pullRequest"]
    closing = pull_request.get("closingIssuesReferences", {})
    if closing.get("pageInfo", {}).get("hasNextPage"):
        raise AutomationError(
            "pull request closes more than 20 issues; refusing partial status update"
        )

    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for issue in closing.get("nodes", []):
        if issue.get("repository", {}).get("nameWithOwner") != repository:
            continue
        issue_id = str(issue["id"])
        if issue_id in seen:
            continue
        seen.add(issue_id)
        result.append(issue)
    return result


PROJECT_QUERY = """
query($login: String!) {
  user(login: $login) {
    projectsV2(first: 100) {
      nodes { id number title }
    }
  }
}
"""

FIELDS_QUERY = """
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      fields(first: 100) {
        nodes {
          __typename
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}
"""

PULL_REQUEST_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      isDraft
      closingIssuesReferences(first: 20) {
        pageInfo { hasNextPage }
        nodes {
          id
          number
          repository { nameWithOwner }
        }
      }
    }
  }
}
"""

ADD_ITEM_MUTATION = """
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item { id }
  }
}
"""

UPDATE_STATUS_MUTATION = """
mutation(
  $projectId: ID!,
  $itemId: ID!,
  $fieldId: ID!,
  $optionId: String!
) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId,
      itemId: $itemId,
      fieldId: $fieldId,
      value: {singleSelectOptionId: $optionId}
    }
  ) {
    projectV2Item { id }
  }
}
"""


def set_content_status(
    client: GraphQLClient,
    *,
    project_id: str,
    content_id: str,
    field_id: str,
    option_id: str,
) -> str:
    add_data = client.execute(
        ADD_ITEM_MUTATION,
        {"projectId": project_id, "contentId": content_id},
    )
    item = add_data.get("addProjectV2ItemById", {}).get("item")
    if not item or not item.get("id"):
        raise AutomationError(f"project item unavailable for content {content_id}")

    item_id = str(item["id"])
    client.execute(
        UPDATE_STATUS_MUTATION,
        {
            "projectId": project_id,
            "itemId": item_id,
            "fieldId": field_id,
            "optionId": option_id,
        },
    )
    return item_id


def load_event(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AutomationError(f"cannot read GitHub event payload: {exc}") from exc


def main() -> int:
    try:
        token = os.environ.get("GH_TOKEN", "")
        event_path = os.environ.get("GITHUB_EVENT_PATH", "")
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        project_owner = os.environ.get("PROJECT_OWNER", "")
        project_title = os.environ.get("PROJECT_TITLE", "")

        if not event_path:
            raise AutomationError("GITHUB_EVENT_PATH is required")
        if "/" not in repository:
            raise AutomationError("GITHUB_REPOSITORY must be owner/name")
        if not project_owner:
            raise AutomationError("PROJECT_OWNER is required")
        if not project_title:
            raise AutomationError("PROJECT_TITLE is required")

        event = load_event(Path(event_path))
        pull_request_event = event.get("pull_request")
        if not isinstance(pull_request_event, dict):
            raise AutomationError("workflow event does not contain pull_request")

        action = str(event.get("action", ""))
        desired_status = target_status(action, bool(pull_request_event.get("draft")))
        pr_number = int(pull_request_event["number"])
        repo_owner, repo_name = repository.split("/", 1)

        client = GraphQLClient(token)
        project_data = client.execute(PROJECT_QUERY, {"login": project_owner})
        project = choose_project(project_data, project_title)
        project_id = str(project["id"])

        fields_data = client.execute(FIELDS_QUERY, {"projectId": project_id})
        field_id, option_id = choose_status_field(fields_data, desired_status)

        pr_data = client.execute(
            PULL_REQUEST_QUERY,
            {"owner": repo_owner, "name": repo_name, "number": pr_number},
        )
        pull_request = pr_data["repository"]["pullRequest"]
        closing_issues = same_repo_closing_issues(pr_data, repository)

        targets = [
            ("pull request", pr_number, str(pull_request["id"])),
            *[
                ("issue", int(issue["number"]), str(issue["id"]))
                for issue in closing_issues
            ],
        ]

        print(
            f"project-status: action={action} target={desired_status!r} "
            f"project={project_title!r} targets={len(targets)}"
        )
        for kind, number, content_id in targets:
            set_content_status(
                client,
                project_id=project_id,
                content_id=content_id,
                field_id=field_id,
                option_id=option_id,
            )
            print(f"project-status: {kind} #{number} -> {desired_status}")

        return 0
    except (AutomationError, KeyError, TypeError, ValueError) as exc:
        print(f"project-status: FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
