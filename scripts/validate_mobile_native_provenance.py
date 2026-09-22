"""Validate generated Android provenance against the resolved Expo/config SSOT.

This gate runs after `expo prebuild --clean` and before Gradle compilation.
It intentionally validates generated native values rather than trusting a
successful compile as proof that the artifact has the intended identity.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class NativeProvenance:
    git_sha: str
    expo_package: str
    generated_namespace: str
    generated_application_id: str
    expo_version: str
    generated_version_name: str
    expected_runtime_version: str
    generated_runtime_version: str


def _read_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return data


def _required_string(data: dict, *path: str) -> str:
    current: object = data
    for key in path:
        if not isinstance(current, dict) or key not in current:
            raise ValueError(f"missing resolved Expo config field: {'.'.join(path)}")
        current = current[key]
    if not isinstance(current, str) or not current:
        raise ValueError(f"resolved Expo config field is not a non-empty string: {'.'.join(path)}")
    return current


def _gradle_string(text: str, key: str) -> str:
    pattern = re.compile(
        rf"(?m)^\s*{re.escape(key)}\s*(?:=\s*)?[\"']([^\"']+)[\"']\s*$"
    )
    values = pattern.findall(text)
    unique = list(dict.fromkeys(values))
    if not unique:
        raise ValueError(f"generated app/build.gradle has no literal {key}")
    if len(unique) != 1:
        raise ValueError(
            f"generated app/build.gradle has ambiguous {key} values: {unique}"
        )
    return unique[0]


def _runtime_resource(strings_xml: Path) -> str:
    root = ET.parse(strings_xml).getroot()
    matches = [
        element
        for element in root.findall("string")
        if element.attrib.get("name") == "expo_runtime_version"
    ]
    if len(matches) != 1:
        raise ValueError(
            "generated strings.xml must contain exactly one expo_runtime_version "
            f"resource (found {len(matches)})"
        )
    value = (matches[0].text or "").strip()
    if not value:
        raise ValueError("generated expo_runtime_version resource is empty")
    return value


def inspect_native_provenance(
    *,
    expo_config: Path,
    version_file: Path,
    android_dir: Path,
    git_sha: str,
) -> tuple[NativeProvenance | None, list[str]]:
    errors: list[str] = []

    try:
        config = _read_json(expo_config)
        release = _read_json(version_file)

        release_version = release.get("version")
        if not isinstance(release_version, str) or not release_version:
            raise ValueError("version.json.version must be a non-empty string")

        expo_version = _required_string(config, "version")
        expo_package = _required_string(config, "android", "package")

        runtime_config = config.get("runtimeVersion")
        if not (
            isinstance(runtime_config, dict)
            and runtime_config.get("policy") == "appVersion"
        ):
            raise ValueError(
                "resolved Expo runtimeVersion must use policy=appVersion"
            )

        if expo_version != release_version:
            errors.append(
                "resolved Expo version does not match version.json: "
                f"{expo_version!r} != {release_version!r}"
            )

        build_gradle = android_dir / "app" / "build.gradle"
        strings_xml = (
            android_dir / "app" / "src" / "main" / "res" / "values" / "strings.xml"
        )

        gradle_text = build_gradle.read_text(encoding="utf-8")
        generated_namespace = _gradle_string(gradle_text, "namespace")
        generated_application_id = _gradle_string(gradle_text, "applicationId")
        generated_version_name = _gradle_string(gradle_text, "versionName")
        generated_runtime_version = _runtime_resource(strings_xml)

        if generated_namespace != expo_package:
            errors.append(
                "generated Android namespace does not match resolved Expo package: "
                f"{generated_namespace!r} != {expo_package!r}"
            )
        if generated_application_id != expo_package:
            errors.append(
                "generated Android applicationId does not match resolved Expo package: "
                f"{generated_application_id!r} != {expo_package!r}"
            )
        if generated_version_name != release_version:
            errors.append(
                "generated Android versionName does not match version.json: "
                f"{generated_version_name!r} != {release_version!r}"
            )
        if generated_runtime_version != release_version:
            errors.append(
                "generated expo_runtime_version does not match appVersion policy: "
                f"{generated_runtime_version!r} != {release_version!r}"
            )

        provenance = NativeProvenance(
            git_sha=git_sha,
            expo_package=expo_package,
            generated_namespace=generated_namespace,
            generated_application_id=generated_application_id,
            expo_version=expo_version,
            generated_version_name=generated_version_name,
            expected_runtime_version=release_version,
            generated_runtime_version=generated_runtime_version,
        )
        return provenance, errors
    except (OSError, json.JSONDecodeError, ET.ParseError, ValueError) as exc:
        errors.append(str(exc))
        return None, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expo-config", type=Path, required=True)
    parser.add_argument("--version-file", type=Path, required=True)
    parser.add_argument("--android-dir", type=Path, required=True)
    parser.add_argument("--git-sha", required=True)
    args = parser.parse_args()

    provenance, errors = inspect_native_provenance(
        expo_config=args.expo_config,
        version_file=args.version_file,
        android_dir=args.android_dir,
        git_sha=args.git_sha,
    )

    if provenance is not None:
        print(f"native-provenance: git_sha={provenance.git_sha}")
        print(f"native-provenance: expo.package={provenance.expo_package}")
        print(f"native-provenance: generated.namespace={provenance.generated_namespace}")
        print(
            "native-provenance: generated.applicationId="
            f"{provenance.generated_application_id}"
        )
        print(f"native-provenance: expo.version={provenance.expo_version}")
        print(
            "native-provenance: generated.versionName="
            f"{provenance.generated_version_name}"
        )
        print(
            "native-provenance: generated.expo_runtime_version="
            f"{provenance.generated_runtime_version}"
        )

    if errors:
        print("native-provenance: FAIL", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("native-provenance: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
