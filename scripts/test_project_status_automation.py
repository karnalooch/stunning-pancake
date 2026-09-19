from __future__ import annotations

import json
import unittest

from scripts.project_status_automation import (
    AutomationError,
    GraphQLClient,
    choose_project,
    choose_status_field,
    same_repo_closing_issues,
    target_status,
)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class ProjectStatusAutomationTests(unittest.TestCase):
    def test_pull_request_lifecycle_maps_to_expected_status(self):
        self.assertEqual(target_status("opened", True), "In progress")
        self.assertEqual(target_status("opened", False), "In review")
        self.assertEqual(target_status("reopened", True), "In progress")
        self.assertEqual(target_status("reopened", False), "In review")
        self.assertEqual(target_status("converted_to_draft", False), "In progress")
        self.assertEqual(target_status("ready_for_review", True), "In review")

    def test_unsupported_action_fails_closed(self):
        with self.assertRaisesRegex(AutomationError, "unsupported"):
            target_status("closed", False)

    def test_choose_project_requires_exact_unique_title(self):
        data = {
            "user": {
                "projectsV2": {
                    "nodes": [
                        {"id": "P1", "number": 1, "title": "Other"},
                        {
                            "id": "P2",
                            "number": 2,
                            "title": "4VELO — Product & Takeover",
                        },
                    ]
                }
            }
        }
        project = choose_project(data, "4VELO — Product & Takeover")
        self.assertEqual(project["id"], "P2")

        with self.assertRaisesRegex(AutomationError, "not found"):
            choose_project(data, "Missing")

    def test_choose_status_field_resolves_option_by_name(self):
        data = {
            "node": {
                "fields": {
                    "nodes": [
                        {
                            "__typename": "ProjectV2SingleSelectField",
                            "id": "STATUS",
                            "name": "Status",
                            "options": [
                                {"id": "BACKLOG", "name": "Backlog"},
                                {"id": "PROGRESS", "name": "In progress"},
                                {"id": "REVIEW", "name": "In review"},
                            ],
                        }
                    ]
                }
            }
        }
        self.assertEqual(
            choose_status_field(data, "In review"),
            ("STATUS", "REVIEW"),
        )

    def test_closing_issues_are_limited_to_same_repository_and_deduplicated(self):
        data = {
            "repository": {
                "pullRequest": {
                    "closingIssuesReferences": {
                        "pageInfo": {"hasNextPage": False},
                        "nodes": [
                            {
                                "id": "I1",
                                "number": 10,
                                "repository": {
                                    "nameWithOwner": "karnalooch/stunning-pancake"
                                },
                            },
                            {
                                "id": "I1",
                                "number": 10,
                                "repository": {
                                    "nameWithOwner": "karnalooch/stunning-pancake"
                                },
                            },
                            {
                                "id": "I2",
                                "number": 20,
                                "repository": {"nameWithOwner": "elsewhere/repo"},
                            },
                        ],
                    }
                }
            }
        }
        issues = same_repo_closing_issues(data, "karnalooch/stunning-pancake")
        self.assertEqual([issue["number"] for issue in issues], [10])

    def test_closing_issue_pagination_fails_instead_of_updating_partial_set(self):
        data = {
            "repository": {
                "pullRequest": {
                    "closingIssuesReferences": {
                        "pageInfo": {"hasNextPage": True},
                        "nodes": [],
                    }
                }
            }
        }
        with self.assertRaisesRegex(AutomationError, "more than 20"):
            same_repo_closing_issues(data, "karnalooch/stunning-pancake")

    def test_graphql_errors_are_reported_without_token(self):
        def opener(_request, timeout):
            self.assertEqual(timeout, 30)
            return FakeResponse({"errors": [{"message": "permission denied"}]})

        client = GraphQLClient("secret-token-value", opener=opener)
        with self.assertRaisesRegex(AutomationError, "permission denied") as context:
            client.execute("query { viewer { login } }", {})
        self.assertNotIn("secret-token-value", str(context.exception))

    def test_graphql_success_returns_data(self):
        def opener(_request, timeout):
            self.assertEqual(timeout, 30)
            return FakeResponse({"data": {"viewer": {"login": "karnalooch"}}})

        client = GraphQLClient("token", opener=opener)
        self.assertEqual(
            client.execute("query { viewer { login } }", {}),
            {"viewer": {"login": "karnalooch"}},
        )


if __name__ == "__main__":
    unittest.main()
