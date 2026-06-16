#!/usr/bin/env python3
"""
Auto-wire optional vision assets into TypeScript registries.

Usage:
  python scripts/wire_vision_assets.py

The script reads catalog entries from `scripts/asset_definitions.py`, checks
whether each vision file exists in BOTH:
  - assets/generated/<relative_path>
  - mobile/assets/generated/<relative_path>

When both exist, it writes a static `require('../../assets/generated/...')`.
Otherwise it writes `undefined` (CI-safe: no broken require paths).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from asset_definitions import get_all_assets  # noqa: E402

SOURCE_ROOT = REPO_ROOT / "assets" / "generated"
MOBILE_SOURCE_ROOT = REPO_ROOT / "mobile" / "assets" / "generated"
VISION_ASSETS_FILE = REPO_ROOT / "mobile" / "src" / "assets" / "visionAssets.ts"
ASSET_REGISTRY_FILE = REPO_ROOT / "mobile" / "src" / "assets" / "assetRegistry.ts"


@dataclass(frozen=True)
class Item:
    key: str
    output_path: str


def _asset_path_map() -> dict[str, str]:
    out: dict[str, str] = {}
    for asset in get_all_assets():
        asset_id = str(asset.get("id", ""))
        output_path = str(asset.get("output_path", "")).replace("\\", "/")
        if asset_id and output_path:
            out[asset_id] = output_path
    return out


def _exists_in_both_bundles(output_path: str) -> bool:
    return (SOURCE_ROOT / output_path).exists() and (MOBILE_SOURCE_ROOT / output_path).exists()


def _entry_value(output_path: str) -> str:
    if _exists_in_both_bundles(output_path):
        return f"require('../../assets/generated/{output_path}')"
    return "undefined"


def _replace_between_markers(text: str, start_marker: str, end_marker: str, new_lines: list[str]) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    replaced = False
    while i < len(lines):
        line = lines[i]
        if start_marker in line:
            out.append(line)
            i += 1
            while i < len(lines) and end_marker not in lines[i]:
                i += 1
            if i >= len(lines):
                raise RuntimeError(f"Missing end marker: {end_marker}")
            indent_match = re.match(r"^(\s*)", lines[i])
            indent = indent_match.group(1) if indent_match else ""
            for new_line in new_lines:
                out.append(f"{indent}{new_line}")
            out.append(lines[i])
            replaced = True
            i += 1
            continue
        out.append(line)
        i += 1
    if not replaced:
        raise RuntimeError(f"Missing start marker: {start_marker}")
    return "\n".join(out) + "\n"


def _write_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def _build_items() -> tuple[list[Item], list[Item], list[Item], list[Item], list[Item]]:
    by_id = _asset_path_map()
    crests = [
        Item("gdansk", by_id["crest_gdansk"]),
        Item("katowice", by_id["crest_katowice"]),
        Item("lublin", by_id["crest_lublin"]),
        Item("siedlce", by_id["crest_siedlce"]),
        Item("warszawa", by_id["crest_warszawa"]),
    ]
    depts = [
        Item("it", by_id["dept_it"]),
        Item("marketing", by_id["dept_marketing"]),
        Item("hr", by_id["dept_hr"]),
        Item("sales", by_id["dept_sales"]),
    ]
    achievements = [
        Item("ach_100km", by_id["ach_100km"]),
        Item("ach_10rides", by_id["ach_10rides"]),
        Item("ach_500m", by_id["ach_500m"]),
        Item("ach_kom", by_id["ach_kom"]),
        Item("ach_5h", by_id["ach_5h"]),
        Item("ach_endurance", by_id["ach_endurance"]),
        Item("ach_1000kcal", by_id["ach_1000kcal"]),
        Item("ach_7days", by_id["ach_7days"]),
        Item("ach_explorer", by_id["ach_explorer"]),
        Item("ach_passion", by_id["ach_passion"]),
    ]
    banners = [
        Item("city_lublin", by_id["banner_city_lublin"]),
        Item("finish_meta", by_id["finish_meta"]),
        Item("avatar_frame", by_id["avatar_frame"]),
        Item("frame_ornate", by_id["frame_ornate"]),
        Item("sky_sunset", by_id["sky_sunset"]),
        Item("sky_night", by_id["sky_night"]),
    ]
    hud_actions = [
        Item("stop", by_id.get("hud_stop", "icons/hud_stop.png")),
        Item("pause", by_id.get("hud_pause", "icons/hud_pause.png")),
        Item("play", by_id.get("hud_play", "icons/hud_play.png")),
    ]
    return crests, depts, achievements, banners, hud_actions


def _map_to_lines(items: list[Item]) -> list[str]:
    return [f"{item.key}: {_entry_value(item.output_path)}," for item in items]


def _apply_to_vision_assets(crests: list[Item], depts: list[Item], achievements: list[Item], banners: list[Item], hud_actions: list[Item]) -> None:
    content = VISION_ASSETS_FILE.read_text(encoding="utf-8")
    content = _replace_between_markers(content, "AUTO-WIRE:CREST:START", "AUTO-WIRE:CREST:END", _map_to_lines(crests))
    content = _replace_between_markers(content, "AUTO-WIRE:DEPT:START", "AUTO-WIRE:DEPT:END", _map_to_lines(depts))
    content = _replace_between_markers(
        content,
        "AUTO-WIRE:ACHIEVEMENT:START",
        "AUTO-WIRE:ACHIEVEMENT:END",
        _map_to_lines(achievements),
    )
    content = _replace_between_markers(content, "AUTO-WIRE:BANNERS:START", "AUTO-WIRE:BANNERS:END", _map_to_lines(banners))
    content = _replace_between_markers(content, "AUTO-WIRE:HUD_ACTIONS:START", "AUTO-WIRE:HUD_ACTIONS:END", _map_to_lines(hud_actions))
    _write_file(VISION_ASSETS_FILE, content)


def _apply_to_asset_registry(crests: list[Item], depts: list[Item], achievements: list[Item], banners: list[Item]) -> None:
    content = ASSET_REGISTRY_FILE.read_text(encoding="utf-8")
    content = _replace_between_markers(
        content,
        "AUTO-WIRE:REG_CREST:START",
        "AUTO-WIRE:REG_CREST:END",
        _map_to_lines(crests),
    )
    content = _replace_between_markers(
        content,
        "AUTO-WIRE:REG_DEPT:START",
        "AUTO-WIRE:REG_DEPT:END",
        _map_to_lines(depts),
    )
    content = _replace_between_markers(
        content,
        "AUTO-WIRE:REG_ACHIEVEMENT:START",
        "AUTO-WIRE:REG_ACHIEVEMENT:END",
        _map_to_lines(achievements),
    )
    content = _replace_between_markers(
        content,
        "AUTO-WIRE:REG_BANNERS:START",
        "AUTO-WIRE:REG_BANNERS:END",
        _map_to_lines(banners),
    )
    _write_file(ASSET_REGISTRY_FILE, content)


def main() -> int:
    crests, depts, achievements, banners, hud_actions = _build_items()
    _apply_to_vision_assets(crests, depts, achievements, banners, hud_actions)
    _apply_to_asset_registry(crests, depts, achievements, banners)
    wired = sum(1 for item in [*crests, *depts, *achievements, *banners, *hud_actions] if _exists_in_both_bundles(item.output_path))
    total = len(crests) + len(depts) + len(achievements) + len(banners) + len(hud_actions)
    print(f"[wire:vision] updated registries ({wired}/{total} assets wired, missing => undefined)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
