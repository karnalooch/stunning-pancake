# GitHub Project status automation

Status: **ACTIVE SETUP**  
Scope: repository workflow for `4VELO — Product & Takeover`

## Purpose

The repository already uses native GitHub Project workflows for:

- auto-add -> `Backlog`;
- closed Issue -> `Done`;
- merged Pull Request -> `Done`.

`.github/workflows/project-status.yml` fills the missing lifecycle transitions:

| Pull Request event | PR status | linked closing Issue status |
| --- | --- | --- |
| draft PR opened | `In progress` | `In progress` |
| non-draft PR opened | `In review` | `In review` |
| converted to draft | `In progress` | `In progress` |
| ready for review | `In review` | `In review` |
| reopened | derived from draft state | same |

Merge and Issue close remain owned by the native Project workflows. A closed-unmerged PR is intentionally not converted to `Done`.

## One-time authentication setup

The Project is owned by the personal GitHub account `karnalooch`. The automation uses GitHub GraphQL Projects mutations and expects a repository Actions secret named:

`PROJECTS_TOKEN`

Create a **personal access token (classic)** for the account that owns/can edit the Project with the `project` scope, then store it as the repository Actions secret `PROJECTS_TOKEN`.

Do not commit the token, put it in repository variables, print it, or paste it into Issue/PR comments.

Prefer a short expiration and rotate it before expiry. If the repository becomes private, re-evaluate whether additional repository read scope is required.

## Security boundary

The workflow:

- runs on `pull_request`, never `pull_request_target`;
- does not expose `PROJECTS_TOKEN` to fork pull requests;
- grants the built-in `GITHUB_TOKEN` only `contents: read`;
- discovers the Project, Status field and Status option IDs at runtime;
- updates only the PR and same-repository Issues referenced by GitHub's supported `closingIssuesReferences` relationship;
- refuses a partial linked-Issue update if more than 20 closing Issues are returned.

## Verification

After the secret is configured and this workflow is on `main`:

1. open a draft PR containing `Closes #<issue>`;
2. verify PR and Issue become `In progress`;
3. mark the PR Ready for review;
4. verify PR and Issue become `In review`;
5. convert it back to draft and verify both return to `In progress`;
6. merge only after normal review/CI and explicit approval;
7. verify native workflows set the merged PR and closed Issue to `Done`.

A missing/expired/under-scoped token is a real failure. Do not disable the workflow or weaken the gate to hide it.
