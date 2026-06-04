"""Try Railway GraphQL live-resize for osrm-volume."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

API = "https://backboard.railway.com/graphql/v2"
VOLUME_ID = "3bf18490-96a9-490c-8441-22d7e5edaa8e"
ENV_ID = "f30e70a7-b4d2-42aa-8137-21faa091b969"
TARGET_MB = 15000


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


def main() -> None:
    # Introspect input types (single-line queries avoid PS issues when run from py)
    for type_name in ("VolumeInstanceUpdateInput", "VolumeUpdateInput", "VolumeResizeInput"):
        r = gql(
            f'query {{ __type(name: "{type_name}") {{ inputFields {{ name }} }} }}'
        )
        fields = r.get("data", {}).get("__type", {}) or {}
        names = [f["name"] for f in (fields.get("inputFields") or [])]
        print(f"{type_name}:", ", ".join(names) if names else r.get("errors"))

    mutations = [
        (
            "volumeInstanceUpdate+sizeMB",
            """
            mutation($volumeId: String!, $environmentId: String!, $input: VolumeInstanceUpdateInput!) {
              volumeInstanceUpdate(volumeId: $volumeId, environmentId: $environmentId, input: $input)
            }
            """,
            {
                "volumeId": VOLUME_ID,
                "environmentId": ENV_ID,
                "input": {"sizeMB": TARGET_MB},
            },
        ),
        (
            "volumeUpdate+sizeMB",
            """
            mutation($volumeId: String!, $input: VolumeUpdateInput!) {
              volumeUpdate(volumeId: $volumeId, input: $input) { id name }
            }
            """,
            {"volumeId": VOLUME_ID, "input": {"sizeMB": TARGET_MB}},
        ),
        (
            "volumeResize",
            """
            mutation($volumeId: String!, $sizeMB: Int!) {
              volumeResize(volumeId: $volumeId, sizeMB: $sizeMB)
            }
            """,
            {"volumeId": VOLUME_ID, "sizeMB": TARGET_MB},
        ),
        (
            "volumeInstanceResize",
            """
            mutation($volumeInstanceId: String!, $sizeMB: Int!) {
              volumeInstanceResize(volumeInstanceId: $volumeInstanceId, sizeMB: $sizeMB)
            }
            """,
            {"volumeInstanceId": VOLUME_ID, "sizeMB": TARGET_MB},
        ),
    ]
    for label, query, variables in mutations:
        out = gql(query, variables)
        print(f"\n{label}:", json.dumps(out, indent=2)[:800])


if __name__ == "__main__":
    main()
