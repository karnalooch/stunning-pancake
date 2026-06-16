"""
Load full prompt context from docs/design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md (SSOT).

Assembles prompts exactly as the doc specifies:
  §1 reference instruction + attached PNG (in gemini_client)
  §2 hero bible + proven example (character assets)
  §3 global style block (verbatim template, every asset)
  §4 palette reference
  §7–§16 section intro + per-asset prompt + blockquote notes
  §3 shared negatives
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_MD = _REPO_ROOT / "docs" / "design" / "MOBILE_ASSET_NANO_BANANA_PROMPTS.md"
REFERENCE_PNG = _REPO_ROOT / "docs" / "design" / "reference" / "cyklo-siedlce-grand-prix.png"
GENERATED_DIR = _REPO_ROOT / "assets" / "generated"

# Character-lock chain per §5 / per-asset notes (img2img second reference).
CHARACTER_LOCK_FOR: dict[str, str] = {
    "cyclist_sheet": "cyclist_idle",
    "cyclist_happy": "cyclist_idle",
    "cyclist_tired": "cyclist_idle",
    "cyclist_victory": "cyclist_idle",
    "ghost_sheet": "cyclist_sheet",
    "map_marker_cyclist": "cyclist_idle",
    "app_icon": "cyclist_idle",
    "splash_icon": "cyclist_idle",
    "adaptive_icon": "cyclist_idle",
}

CHARACTER_ASSET_IDS = frozenset(
    {
        "cyclist_idle",
        "cyclist_happy",
        "cyclist_tired",
        "cyclist_victory",
        "cyclist_sheet",
        "ghost_sheet",
        "map_marker_cyclist",
        "app_icon",
        "splash_icon",
        "adaptive_icon",
    }
)

GENERATION_ORDER: list[str] = [
    "cyclist_idle",
    "cyclist_sheet",
    "ghost_sheet",
    "cyclist_happy",
    "cyclist_tired",
    "cyclist_victory",
    "env_sky_day",
    "env_hills_far",
    "env_town_mid",
    "env_road_near",
    "particle_atlas",
    "map_marker_cyclist",
    "parchment_grain",
    "metal_plate",
    "wood_grain",
    "tab_home",
    "tab_history",
    "tab_ranking",
    "tab_rewards",
    "tab_profile",
    "grade_s",
    "grade_a",
    "grade_b",
    "grade_c",
    "grade_d",
    "power_speed",
    "power_shield",
    "power_double_xp",
    "power_gps",
    "currency_xp",
    "currency_coin",
    "currency_energy",
    "active_ride_hud_mockup",
    "app_icon",
    "splash_icon",
    "adaptive_icon",
    "favicon",
]


class MissingSsotPromptError(KeyError):
    """Raised when an asset has no prompt in MOBILE_ASSET_NANO_BANANA_PROMPTS.md."""


@dataclass
class AssetEntry:
    asset_id: str
    section_intro: str = ""
    prompt: str = ""
    notes: str = ""


@dataclass
class SsotDocument:
    reference_instruction: str = ""
    hero_bible: str = ""
    proven_example: str = ""
    global_style_template: str = ""
    shared_negatives: str = ""
    palette: str = ""
    assets: dict[str, AssetEntry] = field(default_factory=dict)


def _extract_fenced_code(text: str, after: str | None = None) -> str:
    """First ``` block after optional anchor substring."""
    hay = text[text.index(after) :] if after and after in text else text
    m = re.search(r"```\n(.*?)\n```", hay, re.DOTALL)
    return m.group(1).strip() if m else ""


def _strip_md_noise(text: str) -> str:
    """Light cleanup: drop image links, keep readable prose."""
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


def _parse_section2(text: str) -> tuple[str, str]:
    m = re.search(r"## 2\. Hero character bible.*?(?=## 3\.)", text, re.DOTALL)
    if not m:
        return "", ""
    body = m.group(0)
    proven = _extract_fenced_code(body, "### Proven example prompt")
    # Hero bible = section minus proven subheading block
    hero = re.sub(r"### Proven example prompt.*", "", body, flags=re.DOTALL)
    hero = re.sub(r"^## 2\.[^\n]*\n", "", hero)
    return _strip_md_noise(hero), proven


def _parse_section3(text: str) -> tuple[str, str]:
    m = re.search(r"## 3\. Global style block.*?(?=## 4\.)", text, re.DOTALL)
    if not m:
        return "", ""
    body = m.group(0)
    template = _extract_fenced_code(body)
    neg = re.search(r"\*\*Shared negatives\*\*[^`]*`([^`]+)`", body)
    negatives = neg.group(1).strip() if neg else ""
    return template, negatives


def _parse_section4_palette(text: str) -> str:
    m = re.search(r"## 4\. Palette reference.*?(?=## 5\.)", text, re.DOTALL)
    if not m:
        return ""
    body = m.group(0)
    lines = ["Palette reference (token anchors):"]
    for row in re.finditer(
        r"\|\s*(\w+)\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*([^|]+)\|",
        body,
    ):
        lines.append(f"  {row.group(1)} {row.group(2)} — {row.group(3).strip()}")
    return "\n".join(lines)


def _parse_section1_reference(text: str) -> str:
    m = re.search(r"## 1\. Reference sheet.*?(?=## 2\.)", text, re.DOTALL)
    if not m:
        return (
            "Attach the Cyklo-Siedlce Grand Prix reference sheet on every call. "
            "It locks art direction, palette, hero design and crowd/town energy."
        )
    body = m.group(0)
    body = re.sub(r"\*\*How to attach:\*\*.*", "", body, flags=re.DOTALL)
    body = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    body = re.sub(r"^## 1\.[^\n]*\n", "", body)
    return _strip_md_noise(body)


def _section_intro(section_body: str) -> str:
    """Paragraphs between ## header and first ### asset."""
    before_first = re.split(r"\n### `", section_body, maxsplit=1)[0]
    before_first = re.sub(r"^##[^\n]+\n", "", before_first)
    lines: list[str] = []
    for line in before_first.splitlines():
        s = line.strip()
        if not s or s.startswith("|") or s.startswith("---"):
            continue
        lines.append(s)
    return " ".join(lines)


def _asset_notes(after_prompt: str) -> str:
    notes: list[str] = []
    for line in after_prompt.splitlines():
        s = line.strip()
        if s.startswith(">"):
            notes.append(s.lstrip("> ").strip())
    return " ".join(notes)


def _parse_asset_sections(text: str) -> dict[str, AssetEntry]:
    assets: dict[str, AssetEntry] = {}
    # Asset sections ## 7. onward (any number >= 7; not 1-6 which are prose, not
    # 16b which is handled separately). Prose sections (e.g. 17-21) simply carry
    # no `### `id`` blocks and contribute nothing.
    for sec in re.finditer(
        r"## ([7-9]|\d{2,})\.[^\n]*\n(.*?)(?=\n## |\Z)",
        text,
        re.DOTALL,
    ):
        section_body = sec.group(2)
        intro = _section_intro(sec.group(0))
        chunks = re.split(r"\n### `([^`]+)`", section_body)
        for i in range(1, len(chunks), 2):
            asset_id = chunks[i].strip()
            block = chunks[i + 1] if i + 1 < len(chunks) else ""
            # Code-block prompt (HUD-style)
            fenced = re.search(
                r"\*\*Prompt(?:\s*\([^)]*\))?:\*\*\s*\n\n```\n(.*?)\n```",
                block,
                re.DOTALL,
            )
            if fenced:
                prompt = fenced.group(1).strip()
                tail = block[fenced.end() :]
            else:
                inline = re.search(
                    r"\*\*Prompt(?:\s*\([^)]*\))?:\*\*\s*(.+?)(?=\n\n|\n>|$|\n###|\n## )",
                    block,
                    re.DOTALL,
                )
                prompt = " ".join(inline.group(1).split()) if inline else ""
                tail = block[inline.end() :] if inline else block
            notes = _asset_notes(tail)
            assets[asset_id] = AssetEntry(
                asset_id=asset_id,
                section_intro=intro,
                prompt=prompt,
                notes=notes,
            )
    # §16b HUD mockup
    hud = re.search(
        r"## 16b\. Active Ride HUD mockup.*?"
        r"\*\*Prompt \(full, verbatim[^*]*\*\*\s*\n\n```\n(.*?)\n```",
        text,
        re.DOTALL,
    )
    if hud:
        assets["active_ride_hud_mockup"] = AssetEntry(
            asset_id="active_ride_hud_mockup",
            prompt=hud.group(1).strip(),
        )
    return assets


@lru_cache(maxsize=1)
def load_ssot() -> SsotDocument:
    if not PROMPTS_MD.exists():
        return SsotDocument()
    text = PROMPTS_MD.read_text(encoding="utf-8")
    hero, proven = _parse_section2(text)
    global_tpl, negatives = _parse_section3(text)
    return SsotDocument(
        reference_instruction=_parse_section1_reference(text),
        hero_bible=hero,
        proven_example=proven,
        global_style_template=global_tpl,
        shared_negatives=negatives,
        palette=_parse_section4_palette(text),
        assets=_parse_asset_sections(text),
    )


def load_prompt_bodies() -> dict[str, str]:
    return {aid: e.prompt for aid, e in load_ssot().assets.items() if e.prompt}


def get_prompt_body(asset_id: str) -> str | None:
    entry = load_ssot().assets.get(asset_id)
    return entry.prompt if entry and entry.prompt else None


def require_prompt_body(asset_id: str) -> str:
    body = get_prompt_body(asset_id)
    if not body:
        raise MissingSsotPromptError(
            f"No SSOT prompt for '{asset_id}' in {PROMPTS_MD.relative_to(_REPO_ROOT)}"
        )
    return body


def validate_ssot_coverage(asset_ids: list[str]) -> list[str]:
    assets = load_ssot().assets
    return [aid for aid in asset_ids if aid not in assets or not assets[aid].prompt]


def _background_hint(asset_id: str, category: str) -> str:
    if asset_id in ("env_sky_day", "env_road_near"):
        return "full-bleed (no transparency)"
    if category == "icon" and asset_id.startswith("tab_"):
        return "solid #0B1D33 background"
    if asset_id.startswith("grade_") or asset_id.startswith("power_") or asset_id.startswith("currency_"):
        return "transparent background"
    if asset_id in ("cyclist_idle", "cyclist_happy", "cyclist_tired", "cyclist_victory", "cyclist_sheet"):
        return "plain white background for clean preview (trim to transparent in post)"
    if asset_id in ("ghost_sheet", "map_marker_cyclist", "particle_atlas"):
        return "transparent background"
    if asset_id == "active_ride_hud_mockup":
        return "full-bleed 9:16 screen"
    if asset_id in ("app_icon", "splash_icon", "favicon"):
        return "full-bleed as specified"
    if asset_id == "adaptive_icon":
        return "transparent padding around safe zone"
    if category == "environment":
        return "as specified in the per-asset prompt"
    if category == "texture":
        return "seamlessly tileable, as specified"
    return "as specified in the per-asset prompt"


def _needs_hero_context(asset_id: str, category: str) -> bool:
    return asset_id in CHARACTER_ASSET_IDS or category in ("expression", "sprite")


def _isolate_subject(asset_id: str, category: str) -> bool:
    """True for standalone UI chrome that must NOT inherit the hero/town scene.

    Icons (crests, dept glyphs, achievement medals), textures (frames) and
    parallax skies are isolated subjects. Scene environments that legitimately
    contain a cyclist/crowd/buildings (e.g. finish_meta, city banners) are not.
    """
    if category in ("icon", "texture"):
        return True
    if asset_id.startswith("sky_"):
        return True
    return False


def _fill_global_style(template: str, w: int, h: int, bg: str) -> str:
    out = template.replace("{WIDTH}x{HEIGHT}", f"{w}x{h}")
    return out.replace("{BACKGROUND}", bg)


# Scene environments (not character-locked) — per-asset composition guard that
# replaces the §3 hero-on-street template so the real subject is rendered.
_SCENE_CONSTRAINTS: dict[str, str] = {
    "banner_city_lublin": (
        "Wide {w}x{h} pixel-art city panorama ONLY (skyline / old-town rooftops). "
        "Do NOT place any large cyclist or bicycle in the foreground; any people "
        "appear only as tiny distant pixel figures. Keep the lower third visually "
        "calm for an overlaid ribbon. No baked text."
    ),
    "finish_meta": (
        "A {w}x{h} race-finish scene: a checkered black-and-white finish-line "
        "gantry banner spanning the top, a cheering crowd rendered as small pixel "
        "dots waving flags along the sides, and the hero cyclist seen strictly "
        "from BEHIND (rear view, back of helmet and jersey) crossing the line into "
        "a warm sunset. Single hero only. No baked text."
    ),
}


def _compact_palette(palette: str) -> str:
    """Reduce the §4 palette block to bare `name #hex` anchors.

    The full block describes usages ("road asphalt", "red helmet", "foliage,
    hills") that prime the model toward a street scene. For isolated UI chrome we
    keep only the color anchors.
    """
    pairs = re.findall(r"(\w+)\s+(#[0-9A-Fa-f]{6})", palette)
    if not pairs:
        return ""
    return "Palette: " + ", ".join(f"{name} {hexv}" for name, hexv in pairs)


def _build_isolated_prompt(
    asset_id: str, category: str, entry: AssetEntry, w: int, h: int, ssot: SsotDocument
) -> str:
    """Minimal, scene-free prompt for standalone UI chrome and skies.

    The elaborate director brief (reference, hero bible, §3 scene template,
    palette usages, sprite-sheet negatives) makes Nano Banana render the cycling
    scene / multi-item sheets even for flat icons. A short, explicit prompt is far
    more reliable for these assets.
    """
    parts: list[str] = [entry.prompt]

    if asset_id.startswith("sky_"):
        parts.append(
            f"Full-bleed {w}x{h} pixel-art SKY ONLY. The left and right edges must "
            "tile seamlessly when repeated horizontally. Render sky, gradient, "
            "clouds and celestial elements only — absolutely NO buildings, NO "
            "street, NO ground, NO horizon city, NO people, NO cyclist, NO "
            "bicycle, NO text. Crisp pixels, gentle banding, no anti-aliasing."
        )
    else:
        parts.append(
            f"Render EXACTLY ONE single centered pixel-art subject filling most of "
            f"the {w}x{h} frame. Fully transparent background — NO white or colored "
            "box, NO panel, NO scene, NO street, NO buildings, NO people, NO "
            "cyclist, NO bicycle. NEVER a grid, sheet, row, or set of multiple "
            "items — one subject only. Crisp pixels, 1-2px solid black outline, no "
            "anti-aliasing, no drop shadow."
        )

    palette = _compact_palette(ssot.palette)
    if palette:
        parts.append(palette)

    return "\n\n".join(parts)


def build_prompt(asset: dict, *, strict: bool = True) -> str:
    """Assemble the full director brief from the SSOT markdown."""
    ssot = load_ssot()
    asset_id = asset["id"]
    w, h = asset.get("size") or [64, 64]
    category = asset.get("category", "")
    bg = _background_hint(asset_id, category)

    entry = ssot.assets.get(asset_id)
    if strict and (not entry or not entry.prompt):
        raise MissingSsotPromptError(
            f"No SSOT prompt for '{asset_id}' in {PROMPTS_MD.relative_to(_REPO_ROOT)}"
        )
    if not entry:
        entry = AssetEntry(asset_id=asset_id, prompt=asset.get("description", ""))

    # §16b — verbatim only (+ negatives), reference attached separately
    if asset_id == "active_ride_hud_mockup":
        parts = [entry.prompt]
        if ssot.shared_negatives:
            parts.append(f"Shared negatives: {ssot.shared_negatives}")
        return "\n\n".join(parts)

    # Isolated UI chrome / skies — minimal scene-free prompt (short-circuit).
    if _isolate_subject(asset_id, category):
        return _build_isolated_prompt(asset_id, category, entry, w, h, ssot)

    # Scene assets without the hero lock — the §3 template (cyclist on a
    # cobblestone street) overrides their real subject, so build a lean scene
    # prompt instead. The constraint carries the per-scene composition.
    if asset_id in _SCENE_CONSTRAINTS:
        scene_parts = [
            entry.prompt,
            _SCENE_CONSTRAINTS[asset_id].format(w=w, h=h),
            "16-bit SNES/GBA-quality pixel art, vibrant Grand Prix palette, crisp "
            "pixels, 1-2px black outlines, no anti-aliasing, no baked text.",
        ]
        palette = _compact_palette(ssot.palette)
        if palette:
            scene_parts.append(palette)
        return "\n\n".join(scene_parts)

    parts: list[str] = []

    needs_hero = _needs_hero_context(asset_id, category)

    # The reference sheet (and its §1 instruction) is a *character* lock. For
    # UI-chrome assets it makes the model reproduce the cyclist, so only include
    # the reference instruction for assets that actually depict the hero.
    if needs_hero and ssot.reference_instruction:
        parts.append(f"[Reference — §1]\n{ssot.reference_instruction}")

    if _needs_hero_context(asset_id, category) and ssot.hero_bible:
        parts.append(f"[Hero character bible — §2]\n{ssot.hero_bible}")

    if _needs_hero_context(asset_id, category) and ssot.proven_example:
        parts.append(f"[Proven example prompt — §2 character lock]\n{ssot.proven_example}")

    if ssot.global_style_template:
        global_block = _fill_global_style(ssot.global_style_template, w, h, bg)
        parts.append(f"[Global style block — §3]\n{global_block}")

    if ssot.palette:
        parts.append(f"[Palette reference — §4]\n{ssot.palette}")

    if entry.section_intro:
        parts.append(f"[Section context]\n{entry.section_intro}")

    parts.append(f"[Asset: {asset_id}]\n{entry.prompt}")

    if entry.notes:
        parts.append(f"[Director notes]\n{entry.notes}")

    if ssot.shared_negatives:
        parts.append(f"Shared negatives: {ssot.shared_negatives}")

    return "\n\n".join(parts)


def character_lock_path(asset_id: str) -> Path | None:
    """Path to img2img lock PNG for this asset, if generated and applicable."""
    lock_id = CHARACTER_LOCK_FOR.get(asset_id)
    if not lock_id:
        return None
    entry = load_ssot().assets.get(lock_id)
    if not entry:
        return None
    # Resolve output path from asset_definitions pattern
    from asset_definitions import get_asset_by_id

    try:
        lock_asset = get_asset_by_id(lock_id)
    except KeyError:
        return None
    base = GENERATED_DIR
    ob = lock_asset.get("output_base")
    if ob:
        base = _REPO_ROOT / ob
    path = base / lock_asset["output_path"]
    return path if path.exists() else None


def sort_assets_for_generation(assets: list[dict]) -> list[dict]:
    order_index = {aid: i for i, aid in enumerate(GENERATION_ORDER)}
    return sorted(
        assets,
        key=lambda a: (order_index.get(a["id"], 999), a["id"]),
    )
