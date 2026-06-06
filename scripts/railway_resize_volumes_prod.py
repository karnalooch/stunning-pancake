"""Live-resize TimescaleDB and Redis volumes on Railway production."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API = "https://backboard.railway.com/graphql/v2"
PROJECT_ID = "ce13089b-76f4-4114-a892-ad13e23c8761"
ENV_ID = "f30e70a7-b4d2-42aa-8137-21faa091b969"

TARGETS = [
    ("timescaledb-volume", "425b40b8-fee9-4c8c-ac72-ce1f918785bc", 20_000),
    ("redis-volume", "62de8183-f529-4d90-95aa-bb27f369a10e", 2_048),
]


def gql(query: str, variables: dict | None = None) -> dict:
    token = os.environ.get("RAILWAY_API_TOKEN", "").strip()
    if not token:
        print("RAILWAY_API_TOKEN missing", file=sys.stderr)
        sys.exit(1)
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def list_volume_instances() -> None:
    queries = [
        (
            "project volumes",
            """
            query($projectId: String!, $environmentId: String!) {
              project(id: $projectId) {
                volumes(environmentId: $environmentId) {
                  edges { node { id name sizeMB volumeInstances { edges { node { id sizeMB } } } } } }
                }
              }
            }
            """,
            {"projectId": PROJECT_ID, "environmentId": ENV_ID},
        ),
        (
            "volume by id",
            """
            query($id: String!) {
              volume(id: $id) { id name sizeMB volumeInstances { edges { node { id sizeMB environmentId } } } }
            }
            """,
            {"id": TARGETS[0][1]},
        ),
    ]
    for label, q, v in queries:
        try:
            out = gql(q, v)
            print(f"\n{label}:", json.dumps(out, indent=2)[:2000])
        except Exception as exc:
            print(f"\n{label} error:", exc)


def resize_volume(name: str, volume_id: str, size_mb: int) -> bool:
    print(f"\n=== {name} -> {size_mb} MB ===")
    instance_id = None
    try:
        out = gql(
            'query($id: String!) { volume(id: $id) { volumeInstances { edges { node { id sizeMB } } } } }',
            {"id": volume_id},
        )
        edges = (
            out.get("data", {})
            .get("volume", {})
            .get("volumeInstances", {})
            .get("edges", [])
        )
        if edges:
            instance_id = edges[0]["node"]["id"]
            print(f"  volumeInstanceId={instance_id}")
    except Exception as exc:
        print(f"  lookup instance: {exc}")

    attempts: list[tuple[str, str, dict]] = [
        (
            "volumeInstanceUpdate",
            """
            mutation($volumeId: String!, $environmentId: String!, $input: VolumeInstanceUpdateInput!) {
              volumeInstanceUpdate(volumeId: $volumeId, environmentId: $environmentId, input: $input)
            }
            """,
            {
                "volumeId": volume_id,
                "environmentId": ENV_ID,
                "input": {"sizeMB": size_mb},
            },
        ),
        (
            "volumeUpdate",
            """
            mutation($volumeId: String!, $input: VolumeUpdateInput!) {
              volumeUpdate(volumeId: $volumeId, input: $input) { id name sizeMB }
            }
            """,
            {"volumeId": volume_id, "input": {"sizeMB": size_mb}},
        ),
        (
            "volumeResize",
            """
            mutation($volumeId: String!, $sizeMB: Int!) {
              volumeResize(volumeId: $volumeId, sizeMB: $sizeMB)
            }
            """,
            {"volumeId": volume_id, "sizeMB": size_mb},
        ),
    ]
    if instance_id:
        attempts.insert(
            0,
            (
                "volumeInstanceResize",
                """
                mutation($volumeInstanceId: String!, $sizeMB: Int!) {
                  volumeInstanceResize(volumeInstanceId: $volumeInstanceId, sizeMB: $sizeMB)
                }
                """,
                {"volumeInstanceId": instance_id, "sizeMB": size_mb},
            ),
        )

    for label, query, variables in attempts:
        try:
            out = gql(query, variables)
        except urllib.error.HTTPError as exc:
            print(f"  {label}: HTTP {exc.code} {exc.read().decode()[:300]}")
            continue
        if out.get("errors"):
            print(f"  {label}: errors {json.dumps(out['errors'])[:400]}")
            continue
        print(f"  OK via {label}: {json.dumps(out.get('data'), indent=2)[:500]}")
        return True
    return False


def main() -> None:
    if "--inspect" in sys.argv:
        list_volume_instances()
        return
    ok = 0
    for name, vid, mb in TARGETS:
        if resize_volume(name, vid, mb):
            ok += 1
        else:
            print(f"  FAILED all mutations for {name}", file=sys.stderr)
    print(f"\nResized {ok}/{len(TARGETS)} volumes")
    sys.exit(0 if ok == len(TARGETS) else 1)


if __name__ == "__main__":
    main()
