"""Fail closed when native-runtime-affecting mobile changes do not bump appVersion.

Expo uses runtimeVersion.policy=appVersion. Therefore a PR that can change the
native runtime must move version.json.version so an OTA bundle cannot be
published across an incompatible native boundary by accident.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ZERO_SHA = "0" * 40

NATIVE_EXACT = {
    "expo",
    "react-native",
    "@maplibre/maplibre-react-native",
    "@shopify/react-native-skia",
}
NATIVE_PREFIXES = (
    "expo-",
    "react-native-",
    "@react-native/",
    "@react-native-community/",
    "@react-native-firebase/",
)


@dataclass(frozen=True)
class BoundaryResult:
    base_version: str
    head_version: str
    reasons: tuple[str, ...]

    @property
    def requires_bump(self) -> bool:
        return bool(self.reasons)

    @property
    def bumped(self) -> bool:
        return self.base_version != self.head_version


def is_native_runtime_dependency(name: str) -> bool:
    return name in NATIVE_EXACT or name.startswith(NATIVE_PREFIXES)


def native_dependency_changes(base_package: dict, head_package: dict) -> list[str]:
    base = base_package.get("dependencies", {})
    head = head_package.get("dependencies", {})
    if not isinstance(base, dict) or not isinstance(head, dict):
        raise ValueError("mobile/package.json dependencies must be objects")

    names = sorted(set(base) | set(head))
    return [
        name
        for name in names
        if is_native_runtime_dependency(name) and base.get(name) != head.get(name)
    ]


def evaluate_boundary(
    *,
    base_version: str,
    head_version: str,
    base_package: dict,
    head_package: dict,
    app_config_changed: bool,
    native_paths_changed: tuple[str, ...] = (),
) -> BoundaryResult:
    reasons: list[str] = []

    changed_dependencies = native_dependency_changes(base_package, head_package)
    if changed_dependencies:
        reasons.append(
            "native dependency changes: " + ", ".join(changed_dependencies)
        )

    if app_config_changed:
        reasons.append("mobile/app.config.js changed")

    if native_paths_changed:
        reasons.append("native/config-plugin paths changed: " + ", ".join(native_paths_changed))

    return BoundaryResult(
        base_version=base_version,
        head_version=head_version,
        reasons=tuple(reasons),
    )


def _git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout


def _resolve_base(base_sha: str, head_sha: str) -> str:
    if base_sha and base_sha != ZERO_SHA:
        return base_sha
    return _git("rev-parse", f"{head_sha}^").strip()


def _json_at(sha: str, path: str) -> dict:
    data = json.loads(_git("show", f"{sha}:{path}"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} at {sha} must contain a JSON object")
    return data


def _text_at(sha: str, path: str) -> str:
    return _git("show", f"{sha}:{path}")


def _version_at(sha: str) -> str:
    value = _json_at(sha, "version.json").get("version")
    if not isinstance(value, str) or not value:
        raise ValueError(f"version.json.version at {sha} must be a non-empty string")
    return value


def _native_path_changes(base_sha: str, head_sha: str) -> tuple[str, ...]:
    output = _git(
        "diff",
        "--name-only",
        base_sha,
        head_sha,
        "--",
        "mobile/plugins",
        "mobile/android",
        "mobile/ios",
    )
    return tuple(line.strip() for line in output.splitlines() if line.strip())


def validate(base_sha: str, head_sha: str) -> BoundaryResult:
    base_sha = _resolve_base(base_sha, head_sha)

    result = evaluate_boundary(
        base_version=_version_at(base_sha),
        head_version=_version_at(head_sha),
        base_package=_json_at(base_sha, "mobile/package.json"),
        head_package=_json_at(head_sha, "mobile/package.json"),
        app_config_changed=(
            _text_at(base_sha, "mobile/app.config.js")
            != _text_at(head_sha, "mobile/app.config.js")
        ),
        native_paths_changed=_native_path_changes(base_sha, head_sha),
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--head-sha", required=True)
    args = parser.parse_args()

    try:
        result = validate(args.base_sha, args.head_sha)
    except (subprocess.CalledProcessError, json.JSONDecodeError, OSError, ValueError) as exc:
        print(f"mobile-runtime-boundary: ERROR: {exc}", file=sys.stderr)
        return 2

    if not result.requires_bump:
        print(
            "mobile-runtime-boundary: PASS "
            f"(no native-runtime-affecting change; appVersion={result.head_version})"
        )
        return 0

    print("mobile-runtime-boundary: native-runtime-affecting change detected")
    for reason in result.reasons:
        print(f"  - {reason}")
    print(
        "mobile-runtime-boundary: "
        f"appVersion {result.base_version} -> {result.head_version}"
    )

    if not result.bumped:
        print(
            "mobile-runtime-boundary: FAIL: bump version.json.version for this "
            "native runtime boundary",
            file=sys.stderr,
        )
        return 1

    print("mobile-runtime-boundary: PASS (appVersion boundary moved)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
