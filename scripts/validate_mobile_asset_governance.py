#!/usr/bin/env python3
"""Validate 4VELO mobile asset-governance policy."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POLICY = REPO_ROOT / "assets" / "ASSET_GOVERNANCE_V1.json"
VISUAL_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
ID_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*_v[0-9]+$")


def load_policy(path: Path = DEFAULT_POLICY) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def legacy_visual_files(repo_root: Path) -> list[Path]:
    root = repo_root / "assets" / "generated"
    if not root.exists():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in VISUAL_EXTENSIONS
    )


def validate_policy(policy: dict[str, Any], repo_root: Path = REPO_ROOT) -> list[str]:
    errors: list[str] = []

    if policy.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if policy.get("visualFreezeVersion") != "1.2.0":
        errors.append("visualFreezeVersion must remain 1.2.0 until an explicit design-contract revision")

    legacy = policy.get("legacyGeneratedPolicy")
    if not isinstance(legacy, dict):
        return errors + ["legacyGeneratedPolicy must be an object"]

    if legacy.get("defaultStatus") != "legacy_unapproved":
        errors.append("legacy generated assets must default to legacy_unapproved")
    if legacy.get("visualReferenceAllowedForNewUi") is not False:
        errors.append("legacy generated assets must not be visual references for new UI")
    if legacy.get("autoApprovalAllowed") is not False:
        errors.append("legacy generated assets must not be auto-approved")

    actual_visual_count = len(legacy_visual_files(repo_root))
    expected_visual_count = legacy.get("expectedVisualFileCount")
    if expected_visual_count != actual_visual_count:
        errors.append(
            f"legacy visual inventory drift: policy expects {expected_visual_count}, "
            f"repository contains {actual_visual_count}"
        )

    place = policy.get("placeIdentity")
    if not isinstance(place, dict):
        errors.append("placeIdentity must be an object")
    else:
        if place.get("customAssetRequired") is not False:
            errors.append("a place must render without a custom asset")
        if place.get("fallbackRequired") is not True:
            errors.append("place identity fallback must be mandatory")
        if place.get("fallbackType") != "place_badge":
            errors.append("place identity fallback must be the canonical place_badge")
        if place.get("randomFallbackColorsAllowed") is not False:
            errors.append("place badge must not use random colours")
        if place.get("officialCrestRequiresVerifiedSource") is not True:
            errors.append("official crests require a verified source")
        if place.get("officialCrestMayBeAiGenerated") is not False:
            errors.append("official crests must never be AI-generated")
        if place.get("crestRecolorAllowed") is not False:
            errors.append("official crests must not be recoloured")
        if place.get("crestCropAllowed") is not False:
            errors.append("official crests must not be cropped")

    provenance = policy.get("provenance", {})
    official_strategies = set(provenance.get("officialMarksAllowedSourceStrategies", []))
    if official_strategies != {"official_verified_source"}:
        errors.append("official marks must use only official_verified_source")
    if provenance.get("generatedOfficialMarksAllowed") is not False:
        errors.append("generated official marks must be forbidden")

    approval = policy.get("approval", {})
    allowed_statuses = set(approval.get("allowedStatuses", []))
    allowed_sources = set(provenance.get("allowedSourceStrategies", []))

    targets = policy.get("productionTargets")
    if not isinstance(targets, list) or not targets:
        errors.append("productionTargets must be a non-empty list")
        return errors

    seen: set[str] = set()
    for index, target in enumerate(targets):
        if not isinstance(target, dict):
            errors.append(f"productionTargets[{index}] must be an object")
            continue
        asset_id = target.get("id")
        prefix = f"production target #{index}"
        if not isinstance(asset_id, str) or not ID_RE.match(asset_id):
            errors.append(f"{prefix}: id must match snake_case_vN")
            continue
        if asset_id in seen:
            errors.append(f"duplicate production target id: {asset_id}")
        seen.add(asset_id)

        if target.get("status") not in allowed_statuses:
            errors.append(f"{asset_id}: unsupported status {target.get('status')!r}")
        if target.get("sourceStrategy") not in allowed_sources:
            errors.append(f"{asset_id}: unsupported sourceStrategy {target.get('sourceStrategy')!r}")
        if target.get("replaceWithoutApproval") is not False:
            errors.append(f"{asset_id}: replaceWithoutApproval must be false")
        if not target.get("scope"):
            errors.append(f"{asset_id}: scope is required")
        if not target.get("category"):
            errors.append(f"{asset_id}: category is required")
        if not isinstance(target.get("acceptance"), list) or not target["acceptance"]:
            errors.append(f"{asset_id}: non-empty acceptance criteria are required")

        if target.get("status") == "approved":
            prov = target.get("provenance")
            if not isinstance(prov, dict):
                errors.append(f"{asset_id}: approved asset requires provenance")
            else:
                for key in ("sourceType", "sourceReference", "rightsStatus", "sha256"):
                    if not prov.get(key):
                        errors.append(f"{asset_id}: approved provenance missing {key}")
                digest = prov.get("sha256", "")
                if digest and not re.fullmatch(r"[0-9a-f]{64}", str(digest)):
                    errors.append(f"{asset_id}: sha256 must be 64 lowercase hex chars")

    required = set(policy.get("requiredPilotTargets", []))
    missing = sorted(required - seen)
    if missing:
        errors.append("missing required pilot targets: " + ", ".join(missing))

    place_badge = next((t for t in targets if t.get("id") == "place_badge_v1"), None)
    if not place_badge or place_badge.get("sourceStrategy") != "code_generated":
        errors.append("place_badge_v1 must exist and be code_generated")

    for target in targets:
        if target.get("category") == "official_crest" and target.get("sourceStrategy") != "official_verified_source":
            errors.append(f"{target.get('id')}: official crest must use official_verified_source")

    return errors


def main() -> int:
    try:
        policy = load_policy()
    except (OSError, json.JSONDecodeError) as exc:
        print(f"asset-governance: FAIL: cannot read {DEFAULT_POLICY}: {exc}", file=sys.stderr)
        return 1

    errors = validate_policy(policy)
    if errors:
        print("asset-governance: FAIL", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(
        "asset-governance: PASS "
        f"({len(policy['productionTargets'])} production targets, "
        f"{len(legacy_visual_files(REPO_ROOT))} legacy visual files quarantined)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
