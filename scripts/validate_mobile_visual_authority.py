#!/usr/bin/env python3
"""Validate takeover-era 4VELO mobile visual authority."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = REPO_ROOT / "docs" / "design" / "MOBILE_UI_VISUAL_AUTHORITY_V1.json"
MAP_STYLE_PATH = REPO_ROOT / "mobile" / "assets" / "map" / "4velo-ride-v1.json"

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


def validate_mobile_map_style(style: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    if style.get("version") != 8:
        errors.append("mobile map style version must be 8")

    metadata = style.get("metadata", {})
    expected_metadata = {
        "4velo:role": "mobile-ride-basemap",
        "4velo:authority": "github",
        "4velo:editor": "Maputnik",
    }
    for key, value in expected_metadata.items():
        if metadata.get(key) != value:
            errors.append(f"mobile map style metadata {key} must be {value!r}")

    serialized = json.dumps(style)
    for forbidden in (
        "demotiles.maplibre.org",
        "tile.openstreetmap.org",
        "__TILEJSON_DOMAIN__",
    ):
        if forbidden in serialized:
            errors.append(f"mobile map style contains forbidden source: {forbidden}")

    source = style.get("sources", {}).get("openmaptiles", {})
    if source.get("url") != "https://tiles.openfreemap.org/planet":
        errors.append("mobile map style must use the declared OpenFreeMap vector source")

    attribution = str(source.get("attribution", ""))
    if "OpenMapTiles" not in attribution or "OpenStreetMap" not in attribution:
        errors.append("mobile map style must retain OpenMapTiles and OpenStreetMap attribution")

    layers = style.get("layers", [])
    if not isinstance(layers, list) or len(layers) < 50:
        errors.append("mobile map style unexpectedly lost its full vector layer set")

    return errors


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

    tooling_gate = policy.get("toolingGate", {})
    if tooling_gate.get("githubSystemOfRecord") is not True:
        errors.append("toolingGate.githubSystemOfRecord must remain true")
    if tooling_gate.get("saasOnlyAuthorityAllowed") is not False:
        errors.append("toolingGate.saasOnlyAuthorityAllowed must remain false")
    if tooling_gate.get("researchOnlySourcesExempt") is not True:
        errors.append("toolingGate.researchOnlySourcesExempt must remain true")
    if tooling_gate.get("licenseAndProvenanceRequired") is not True:
        errors.append("toolingGate.licenseAndProvenanceRequired must remain true")
    if tooling_gate.get("vendorLockInFallbackRequired") is not True:
        errors.append("toolingGate.vendorLockInFallbackRequired must remain true")

    required_modes = {
        "native_github_repository_or_component_integration",
        "deterministic_cli_api_export_to_versioned_repo_artifact",
    }
    modes = set(tooling_gate.get("acceptedIntegrationModes", []))
    missing_modes = required_modes - modes
    if missing_modes:
        errors.append(
            "toolingGate.acceptedIntegrationModes missing: "
            + ", ".join(sorted(missing_modes))
        )

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
        normalized = text.casefold()
        for phrase in REQUIRED_ARCHITECTURE_PHRASES:
            if phrase.casefold() not in normalized:
                errors.append(f"visual architecture missing required phrase: {phrase}")

    contract = repo_root / "docs" / "design" / "MOBILE_UI_DESIGN_CONTRACT_V1.md"
    if not contract.exists():
        errors.append("current mobile UI design contract is missing")
    else:
        text = contract.read_text(encoding="utf-8").lower()
        for phrase in FORBIDDEN_CURRENT_CONTRACT_PHRASES:
            if phrase in text:
                errors.append(f"current design contract still contains superseded rule: {phrase}")

    if not MAP_STYLE_PATH.exists():
        errors.append("repo-owned mobile map style is missing")
    else:
        try:
            style = json.loads(MAP_STYLE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"repo-owned mobile map style is invalid JSON: {exc}")
        else:
            errors.extend(validate_mobile_map_style(style))

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
