"""4VELO product-version single source of truth.

The public/store version is ``version.json.version`` (numeric MAJOR.MINOR.PATCH).
``prerelease`` is used only for repository/package SemVer labels such as
``0.3.3-dev`` or ``0.3.3-rc.1``. Native Android/iOS build identifiers are
managed remotely by EAS and are intentionally not stored here.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VERSION_FILE = REPO / "version.json"
PACKAGE_FILES = (
    REPO / "package.json",
    REPO / "mobile" / "package.json",
    REPO / "admin" / "package.json",
)
MOBILE_APP_CONFIG = REPO / "mobile" / "app.config.js"
EAS_CONFIG = REPO / "mobile" / "eas.json"
ROOT_EXPO_CONFIG = REPO / "app.json"
ROOT_EAS_CONFIG = REPO / "eas.json"
CHANGELOG = REPO / "CHANGELOG.md"

VERSION_RE = re.compile(r"^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$")
PRERELEASE_RE = re.compile(r"^[0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*$")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_release(path: Path = VERSION_FILE) -> dict:
    data = read_json(path)
    if data.get("schemaVersion") != 1:
        raise ValueError("version.json schemaVersion must be 1")
    version = data.get("version")
    prerelease = data.get("prerelease", "")
    if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
        raise ValueError("version must be numeric MAJOR.MINOR.PATCH")
    if not isinstance(prerelease, str):
        raise ValueError("prerelease must be a string")
    if prerelease and not PRERELEASE_RE.fullmatch(prerelease):
        raise ValueError("prerelease is not a valid SemVer prerelease identifier")
    return {"version": version, "prerelease": prerelease}


def semver_label(release: dict) -> str:
    suffix = release["prerelease"]
    return release["version"] if not suffix else f'{release["version"]}-{suffix}'


def check_contract(*, tag: str | None = None) -> list[str]:
    errors: list[str] = []
    try:
        release = load_release()
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return [f"version.json: {exc}"]

    label = semver_label(release)

    for path in PACKAGE_FILES:
        try:
            actual = read_json(path).get("version")
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(REPO)}: {exc}")
            continue
        if actual != label:
            errors.append(
                f"{path.relative_to(REPO)} version={actual!r}; expected {label!r}"
            )

    try:
        app_config = MOBILE_APP_CONFIG.read_text(encoding="utf-8")
        if "require('../version.json')" not in app_config:
            errors.append("mobile/app.config.js must read ../version.json")
        if '"version": releaseVersion.version' not in app_config:
            errors.append(
                "mobile/app.config.js must source Expo version from releaseVersion.version"
            )
        if '"policy": "appVersion"' not in app_config:
            errors.append("mobile/app.config.js runtimeVersion policy must remain appVersion")
    except OSError as exc:
        errors.append(f"mobile/app.config.js: {exc}")

    try:
        eas = read_json(EAS_CONFIG)
        if eas.get("cli", {}).get("appVersionSource") != "remote":
            errors.append("mobile/eas.json cli.appVersionSource must be remote")
        if eas.get("build", {}).get("production", {}).get("autoIncrement") is not True:
            errors.append("mobile/eas.json production.autoIncrement must be true")
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"mobile/eas.json: {exc}")

    if ROOT_EXPO_CONFIG.exists():
        errors.append("root app.json is forbidden; mobile/app.config.js is the Expo SSOT")
    if ROOT_EAS_CONFIG.exists():
        errors.append("root eas.json is forbidden; mobile/eas.json is the EAS SSOT")

    try:
        changelog = CHANGELOG.read_text(encoding="utf-8")
        if f"## v{label} " not in changelog and f"## v{label} (" not in changelog:
            errors.append(f"CHANGELOG.md has no release heading for v{label}")
    except OSError as exc:
        errors.append(f"CHANGELOG.md: {exc}")

    if tag:
        expected_tag = f'v{release["version"]}'
        if release["prerelease"]:
            errors.append(
                f"release tag {tag!r} is forbidden while prerelease={release['prerelease']!r}"
            )
        if tag != expected_tag:
            errors.append(f"release tag {tag!r}; expected {expected_tag!r}")

    return errors


def _json_bytes(data: dict) -> bytes:
    return (json.dumps(data, indent=2) + chr(10)).encode("utf-8")


def _write_temp(path: Path, payload: bytes) -> Path:
    """Write a durable sibling temp file suitable for atomic replacement."""

    fd, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise
    return temp_path


def set_version(version: str, prerelease: str) -> None:
    candidate = {"schemaVersion": 1, "version": version, "prerelease": prerelease}
    if not VERSION_RE.fullmatch(version):
        raise ValueError("version must be numeric MAJOR.MINOR.PATCH")
    if prerelease and not PRERELEASE_RE.fullmatch(prerelease):
        raise ValueError("invalid prerelease identifier")

    # Build and validate the complete update before touching the repository.
    # This prevents a missing or malformed package.json from leaving the SSOT
    # and package labels at different versions.
    label = semver_label(candidate)
    payloads: dict[Path, bytes] = {}
    originals: dict[Path, bytes] = {}

    for path in PACKAGE_FILES:
        data = read_json(path)
        if not isinstance(data, dict):
            raise ValueError(f"{path.relative_to(REPO)} must contain a JSON object")
        data["version"] = label
        payloads[path] = _json_bytes(data)
        originals[path] = path.read_bytes()

    originals[VERSION_FILE] = VERSION_FILE.read_bytes()
    payloads[VERSION_FILE] = _json_bytes(candidate)

    # Stage every target first. Replacements are same-filesystem atomic.
    # version.json is committed last so readers never observe a new SSOT
    # while package labels are still on the previous version.
    staged: dict[Path, Path] = {}
    replaced: list[Path] = []
    try:
        for path, payload in payloads.items():
            staged[path] = _write_temp(path, payload)

        ordered_targets = [*PACKAGE_FILES, VERSION_FILE]
        for path in ordered_targets:
            os.replace(staged[path], path)
            staged.pop(path, None)
            replaced.append(path)
    except Exception:
        # Best-effort rollback for a rare filesystem failure after one or more
        # replacements. Common parse/missing-file failures happen before any
        # mutation at all.
        for path in reversed(replaced):
            rollback = None
            try:
                rollback = _write_temp(path, originals[path])
                os.replace(rollback, path)
            finally:
                if rollback is not None:
                    rollback.unlink(missing_ok=True)
        raise
    finally:
        for temp_path in staged.values():
            temp_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    check = sub.add_parser("check")
    check.add_argument("--tag", default=None)

    sub.add_parser("show")

    set_cmd = sub.add_parser("set")
    set_cmd.add_argument("version")
    set_cmd.add_argument("--prerelease", default="")

    args = parser.parse_args()
    if args.command == "show":
        print(semver_label(load_release()))
        return 0
    if args.command == "set":
        try:
            set_version(args.version, args.prerelease)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            print(f"version:set: FAIL: {exc}", file=sys.stderr)
            return 1
        print(f"version:set: {semver_label(load_release())}")
        return 0

    errors = check_contract(tag=args.tag or None)
    if errors:
        print("version:check: FAIL", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"version:check: PASS ({semver_label(load_release())})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
