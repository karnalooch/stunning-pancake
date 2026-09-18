#!/usr/bin/env python3
"""Validate takeover-era 4VELO mobile visual authority."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = REPO_ROOT / "docs" / "design" / "MOBILE_UI_VISUAL_AUTHORITY_V1.json"

FORBIDDEN_CURRENT_CONTRACT_PHRASES = (
    "deep/dark green as the principal brand field",
    "gold or strong green depending on context",
)

REQUIRED_ARCHITECTURE_PHRASES = (
    "HARD VISUAL FREEZE",
    "UI Visual Protection Architecture v1",
    "all mobile UI/design/art-direction/mockup decisions authored **before the takeover master plan T00 / PR #60** are historical evidence only",
    "primary action orange",
    "Green must not be used for",
    "Full celebration is allowed **only after durable success**",
    "do not reinterpret it",
)


def load_policy(path: Path = POLICY_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(policy: dict[str, Any], repo_root: Path = REPO_ROOT) -> list[str]:
    errors: list[str] = []

    if policy.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if policy.get("visualFreezeVersion") != "1.2.0":
        errors.append("visualFreezeVersion must be 1.2.0 until explicit L2 approval")
    if policy.get("scope") != "mobile_visual_only":
        errors.append("scope must remain mobile_visual_only")

    boundary = policy.get("supersessionBoundary", {})
    if boundary.get("t00PullRequest") != 60:
        errors.append("supersession boundary must remain T00 / PR #60")
    if boundary.get("originalMasterPlanHistoricalBase") != "1f6dfcb":
        errors.append("historical takeover base must remain 1f6dfcb")

    current = policy.get("currentAuthority", [])
    if not isinstance(current, list) or not current:
        errors.append("currentAuthority must be a non-empty list")
    else:
        for relative in current:
            if not (repo_root / relative).exists():
                errors.append(f"current authority source missing: {relative}")

    marker = policy.get("legacyMarker")
    legacy = policy.get("legacyVisualSources", [])
    if not isinstance(marker, str) or not marker:
        errors.append("legacyMarker must be defined")
    if not isinstance(legacy, list) or not legacy:
        errors.append("legacyVisualSources must be a non-empty list")
    else:
        for relative in legacy:
            path = repo_root / relative
            if not path.exists():
                errors.append(f"legacy visual source missing: {relative}")
                continue
            if marker not in path.read_text(encoding="utf-8", errors="replace"):
                errors.append(f"legacy visual source lacks superseded marker: {relative}")

    expected = {
        "shell": "navy",
        "canvas": "cream",
        "primaryAction": "orange",
        "progressAccent": "amber",
        "genericGreenSelectionAllowed": False,
        "pixelFontRoutineUiAllowed": False,
        "routineArcadeChromeAllowed": False,
        "activeRideDecorativeSceneAllowed": False,
        "summaryCelebrationRequiresDurableSuccess": True,
        "legacyGeneratedAssetsAreVisualReference": False,
    }
    assertions = policy.get("frozenAssertions", {})
    for key, value in expected.items():
        if assertions.get(key) != value:
            errors.append(f"frozen assertion drift: {key} must be {value!r}")

    architecture = repo_root / "docs" / "design" / "MOBILE_UI_VISUAL_PROTECTION_ARCHITECTURE_V1.md"
    if not architecture.exists():
        errors.append("visual protection architecture is missing")
    else:
        text = architecture.read_text(encoding="utf-8")
        for phrase in REQUIRED_ARCHITECTURE_PHRASES:
            if phrase not in text:
                errors.append(f"visual architecture missing required phrase: {phrase}")

    contract = repo_root / "docs" / "design" / "MOBILE_UI_DESIGN_CONTRACT_V1.md"
    if not contract.exists():
        errors.append("current mobile UI design contract is missing")
    else:
        text = contract.read_text(encoding="utf-8").lower()
        for phrase in FORBIDDEN_CURRENT_CONTRACT_PHRASES:
            if phrase in text:
                errors.append(f"current design contract still contains superseded rule: {phrase}")

    globs = set(policy.get("nonNormativeGlobs", []))
    for required_glob in (
        "docs/archive/**",
        "docs/mockups/**",
        "docs/design/screenshots/**",
        "assets/generated/**",
        "mobile/assets/generated/**",
    ):
        if required_glob not in globs:
            errors.append(f"missing non-normative legacy glob: {required_glob}")

    return errors


def main() -> int:
    try:
        policy = load_policy()
    except (OSError, json.JSONDecodeError) as exc:
        print(f"visual-authority: FAIL: {exc}", file=sys.stderr)
        return 1

    errors = validate(policy)
    if errors:
        print("visual-authority: FAIL", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(
        "visual-authority: PASS "
        f"(freeze={policy['visualFreezeVersion']}, legacy_sources={len(policy['legacyVisualSources'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
