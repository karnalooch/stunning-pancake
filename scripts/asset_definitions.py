"""
Asset Definitions Catalog

Structured definitions for every asset specified in the
Mobile Asset Enhancement Proposal. Each definition includes:
  - id, category, model routing, format, size, description
  - style_constraints (pixel-art rules specific to this asset)
  - output_path relative to assets/generated/
  - cycling-specific context

Model routing:
  - 'deepseek' → SVG icons, JSON manifests, prompt refinement
  - 'gemini'   → Sprite sheets, textures, avatar expressions
"""

from typing import Dict, Any, List

# ─── Type alias ───────────────────────────────────────────────────
AssetDef = Dict[str, Any]

# ─── Color palette reference (embedded for prompts) ───────────────
TOKEN_COLORS = {
    "goldAmber": "#D4A373",
    "goldLight": "#EDD9B0",
    "forestGreen": "#7BA05B",
    "cream": "#F5E6CC",
    "sepia": "#C8B098",
    "deepSea": "#0B1D33",
    "parchment": "#2D2418",
    "error": "#CC4444",
    "warning": "#E8A840",
    "silver": "#A0A0A0",
    "industrial": "#4A4A4A",
    "pixelBlack": "#000000",
    "metalGray": "#2B303A",
}


# ─── All Asset Definitions ────────────────────────────────────────

def get_all_assets() -> List[AssetDef]:
    """Return the complete ordered list of asset definitions.

    Order follows the proposal phases:
      Phase 1 (P0): tab bar icons, grade badges, sounds
      Phase 2 (P1): ambient, fonts, glows
      Phase 3 (P1-P2): sprites, expressions, particles
      Phase 4 (P2): textures, sprite sheets

    Returns:
        List of AssetDef dictionaries
    """
    return [
        # ═══════════════════════════════════════════════════════════
        # TAB BAR ICONS (P0) — DeepSeek SVG, 24×24
        # ═══════════════════════════════════════════════════════════
        {
            "id": "tab_home",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Bicycle wheel hub with spokes. Pixel-art home icon for cycling app "
                "tab bar. Should look like a detailed bike wheel viewed from the side "
                "— circular hub in center, 4-6 straight spokes radiating outward, "
                "minimal tire outline. Gold (#D4A373) hub and spokes, dark "
                "background (#0B1D33)."
            ),
            "style_constraints": "Symmetrical wheel design. Use goldAmber for active state.",
            "output_path": "icons/tab_home.svg",
        },
        {
            "id": "tab_history",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Route trail with waypoint dots. Pixel-art history icon for cycling "
                "activity log. A winding path/route line with small dot waypoints "
                "along it, representing a cycling trail on a map. "
                "Sepia (#C8B098) trail line, cream (#F5E6CC) waypoints."
            ),
            "style_constraints": "Winding path, 3-4 waypoint dots. Clean pixel stepping for the trail.",
            "output_path": "icons/tab_history.svg",
        },
        {
            "id": "tab_ranking",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Podium with small bicycle silhouette. Pixel-art leaderboard icon. "
                "Three-tier podium (1st/2nd/3rd place) with a tiny bike outline "
                "on the top step. Gold (#D4A373) 1st place, silver (#A0A0A0) 2nd, "
                "sepia (#C8B098) 3rd."
            ),
            "style_constraints": "Three distinct podium heights. Small bike icon on top.",
            "output_path": "icons/tab_ranking.svg",
        },
        {
            "id": "tab_rewards",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Trophy cup with bike chain detail. Pixel-art rewards icon. "
                "A classic trophy cup shape with a small bike chain link pattern "
                "on the cup body. Gold (#D4A373) trophy, goldLight (#EDD9B0) "
                "highlights."
            ),
            "style_constraints": "Trophy silhouette. Chain link pattern on cup body.",
            "output_path": "icons/tab_rewards.svg",
        },
        {
            "id": "tab_profile",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Cycling helmet/visor. Pixel-art profile icon. A stylized cycling "
                "helmet viewed from the front — aerodynamic shape with visor and "
                "ventilation slits. Gold (#D4A373) helmet body with "
                "dark (#0B1D33) vents."
            ),
            "style_constraints": "Aerodynamic helmet shape. Visor and vent details.",
            "output_path": "icons/tab_profile.svg",
        },

        # ═══════════════════════════════════════════════════════════
        # GRADE BADGES (P0) — DeepSeek SVG, 32×32
        # ═══════════════════════════════════════════════════════════
        {
            "id": "grade_s",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [32, 32],
            "description": (
                "S-rank gold badge with ornate border. Top-tier achievement badge "
                "for cycling app. Large bold 'S' letter centered, surrounded by "
                "ornate pixel-art border with bike chain link pattern. "
                "Gold (#D4A373) main color, goldLight (#EDD9B0) highlight, "
                "pixelBlack (#000000) outline."
            ),
            "style_constraints": "Ornate border. Large bold 'S'. Chain link border pattern.",
            "output_path": "icons/grade_s.svg",
        },
        {
            "id": "grade_a",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [32, 32],
            "description": (
                "A-rank silver badge. Second-tier achievement badge. "
                "Bold 'A' letter centered, silver border. "
                "Silver (#A0A0A0) main color, cream (#F5E6CC) highlight."
            ),
            "style_constraints": "Clean silver badge. Bold 'A' letter.",
            "output_path": "icons/grade_a.svg",
        },
        {
            "id": "grade_b",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [32, 32],
            "description": (
                "B-rank bronze badge. Third-tier achievement badge. "
                "Bold 'B' letter, warm bronze color using warning (#E8A840)."
            ),
            "style_constraints": "Warm bronze badge. Bold 'B' letter.",
            "output_path": "icons/grade_b.svg",
        },
        {
            "id": "grade_c",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [32, 32],
            "description": (
                "C-rank grey badge. Lower-tier achievement badge. "
                "Bold 'C' letter, industrial grey color (#4A4A4A)."
            ),
            "style_constraints": "Grey badge. Bold 'C' letter. Simple border.",
            "output_path": "icons/grade_c.svg",
        },
        {
            "id": "grade_d",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [32, 32],
            "description": (
                "D-rank red badge. Lowest achievement tier. "
                "Bold 'D' letter, error red (#CC4444). Simple border."
            ),
            "style_constraints": "Red badge. Bold 'D' letter. Simple border.",
            "output_path": "icons/grade_d.svg",
        },

        # ═══════════════════════════════════════════════════════════
        # POWER-UP ICONS (P1) — DeepSeek SVG, 24×24
        # ═══════════════════════════════════════════════════════════
        {
            "id": "power_speed",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Winged bicycle wheel — speed boost power-up. "
                "A bike wheel with small wings attached to the sides. "
                "Gold (#D4A373) wheel, goldLight (#EDD9B0) wings."
            ),
            "style_constraints": "Wheel + wings combo. Dynamic speed feel.",
            "output_path": "icons/power_speed.svg",
        },
        {
            "id": "power_shield",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Cycling helmet as shield — protection power-up. "
                "A helmet shape with shield/defense connotations. "
                "Forest green (#7BA05B) with gold (#D4A373) trim."
            ),
            "style_constraints": "Helmet-as-shield concept. Protective feel.",
            "output_path": "icons/power_shield.svg",
        },
        {
            "id": "power_double_xp",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Two crossed bicycles — double XP power-up. "
                "Two small bicycle silhouettes crossing in an X pattern. "
                "Gold (#D4A373) and goldLight (#EDD9B0)."
            ),
            "style_constraints": "Two bikes crossing. Clean recognizable bike silhouette.",
            "output_path": "icons/power_double_xp.svg",
        },
        {
            "id": "power_gps",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [24, 24],
            "description": (
                "Compass rose — GPS lock power-up. "
                "An 8-point compass star/rose design. "
                "Gold (#D4A373) main points, cream (#F5E6CC) secondary points, "
                "deep sea (#0B1D33) background."
            ),
            "style_constraints": "Compass rose with 4 or 8 points. Navigation feel.",
            "output_path": "icons/power_gps.svg",
        },

        # ═══════════════════════════════════════════════════════════
        # CURRENCY ICONS (P1) — DeepSeek SVG, 16×16
        # ═══════════════════════════════════════════════════════════
        {
            "id": "currency_xp",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [16, 16],
            "description": (
                "XP orb — gold cube with 'XP' text. Small pixel-art experience "
                "point icon. A cube shape (isometric 3D pixel look) with tiny "
                "XP lettering or just a star on top. "
                "Gold (#D4A373) cube, goldLight (#EDD9B0) top face."
            ),
            "style_constraints": "Tiny cube, readable at 16px. Gold colors.",
            "output_path": "icons/currency_xp.svg",
        },
        {
            "id": "currency_coin",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [16, 16],
            "description": (
                "Gold coin — pixel circle with star center. "
                "A round coin with a small 4-point star in the center. "
                "Gold (#D4A373) rim, goldLight (#EDD9B0) face, "
                "pixelBlack (#000000) outline."
            ),
            "style_constraints": "Round pixel circle. Star in center. Gold colors.",
            "output_path": "icons/currency_coin.svg",
        },
        {
            "id": "currency_energy",
            "category": "icon",
            "model": "deepseek",
            "format": "svg",
            "size": [16, 16],
            "description": (
                "Energy bolt — jagged lightning shape. "
                "A sharp, jagged lightning bolt. "
                "Warning amber (#E8A840) body, goldLight (#EDD9B0) highlight."
            ),
            "style_constraints": "Jagged/z字形 lightning. Sharp angles only.",
            "output_path": "icons/currency_energy.svg",
        },

        # ═══════════════════════════════════════════════════════════
        # AVATAR EXPRESSIONS (P2) — Gemini PNG, 64×64 each
        # ═══════════════════════════════════════════════════════════
        {
            "id": "cyclist_idle",
            "category": "expression",
            "model": "gemini",
            "format": "png",
            "size": [64, 64],
            "description": (
                "Neutral cyclist face with helmet. A pixel-art cyclist character "
                "portrait. Wearing a cycling helmet, neutral/determined expression. "
                "Jersey collar visible. Warm gold (#D4A373) helmet, "
                "deep sea (#0B1D33) jersey, cream (#F5E6CC) skin tone."
            ),
            "style_constraints": "64x64 cyclist portrait. Helmet required. Neutral expression.",
            "frames": 1,
            "output_path": "expressions/cyclist_idle.png",
        },
        {
            "id": "cyclist_happy",
            "category": "expression",
            "model": "gemini",
            "format": "png",
            "size": [64, 64],
            "description": (
                "Happy cyclist face with sparkle eyes. Same cyclist character "
                "but with a big smile and sparkle/star shapes in the eyes. "
                "Celebration mood — just got a personal best or achievement."
            ),
            "style_constraints": "64x64 cyclist portrait. Same helmet/jersey. Happy expression, sparkle eyes.",
            "frames": 1,
            "output_path": "expressions/cyclist_happy.png",
        },
        {
            "id": "cyclist_tired",
            "category": "expression",
            "model": "gemini",
            "format": "png",
            "size": [64, 64],
            "description": (
                "Exhausted cyclist face with sweat drop. Same cyclist character "
                "looking tired after a hard ride. Sweat drop on forehead, "
                "slightly drooped eyes, heavy breathing implied."
            ),
            "style_constraints": "64x64 cyclist portrait. Same helmet/jersey. Tired expression, sweat drop.",
            "frames": 1,
            "output_path": "expressions/cyclist_tired.png",
        },
        {
            "id": "cyclist_victory",
            "category": "expression",
            "model": "gemini",
            "format": "png",
            "size": [64, 64],
            "description": (
                "Victory cyclist — arms raised celebrating. Cyclist character "
                "with both arms up in victory/celebration pose. "
                "Wide smile, triumphant expression. Mission complete!"
            ),
            "style_constraints": "64x64 cyclist portrait. Same helmet/jersey. Arms raised, victory expression.",
            "frames": 1,
            "output_path": "expressions/cyclist_victory.png",
        },

        # ═══════════════════════════════════════════════════════════
        # SPRITE SHEETS (P2) — Gemini PNG
        # ═══════════════════════════════════════════════════════════
        {
            "id": "cyclist_sheet",
            "category": "sprite",
            "model": "gemini",
            "format": "png",
            "size": [512, 64],
            "frames": 8,
            "frame_width": 64,
            "frame_height": 64,
            "description": (
                "8-frame cyclist pedaling animation sprite sheet. A pixel-art "
                "cyclist on a road bike, pedaling motion across 8 frames. "
                "The cyclist wears a gold (#D4A373) helmet and deep sea (#0B1D33) "
                "jersey. Bike frame in silver (#A0A0A0) with gold accents. "
                "Viewed from the side, moving right. Each frame shows a different "
                "pedal position (complete 360° pedal cycle over 8 frames). "
                "Black (#000000) 1px outlines on all shapes."
            ),
            "style_constraints": (
                "Side-view cyclist. 8 distinct pedal positions. "
                "No ground — cyclist floats in frame. Consistent size across frames."
            ),
            "output_path": "sprites/cyclist_sheet.png",
        },
        {
            "id": "ghost_sheet",
            "category": "sprite",
            "model": "gemini",
            "format": "png",
            "size": [256, 64],
            "frames": 4,
            "frame_width": 64,
            "frame_height": 64,
            "description": (
                "4-frame ghost cyclist floating animation. A translucent/ghostly "
                "version of the cyclist for pace comparison. Same cyclist shape "
                "but rendered in semi-transparent sepia (#C8B098) with a subtle "
                "glow effect (not anti-aliased — use dithering for transparency). "
                "Floating/gliding motion across 4 frames. No pedaling — smooth float."
            ),
            "style_constraints": (
                "Ghost/translucent cyclist. 4 float frames. Sepia tone. "
                "Use dithering, not alpha gradient, for ghost effect."
            ),
            "output_path": "sprites/ghost_sheet.png",
        },

        # ═══════════════════════════════════════════════════════════
        # TEXTURES (P2) — Gemini PNG, 128×128 tileable
        # ═══════════════════════════════════════════════════════════
        {
            "id": "parchment_grain",
            "category": "texture",
            "model": "gemini",
            "format": "png",
            "size": [128, 128],
            "description": (
                "Parchment paper grain texture — tileable 128×128. "
                "Subtle warm paper fiber texture for Octopath-style idle screens. "
                "Very subtle — 5-8% visibility. Warm brown (#2D2418) fibers on "
                "cream (#F5E6CC) base. Must tile seamlessly."
            ),
            "style_constraints": "Tileable. Very subtle (5-8% visibility). Paper fiber look.",
            "output_path": "textures/parchment_grain.png",
        },
        {
            "id": "metal_plate",
            "category": "texture",
            "model": "gemini",
            "format": "png",
            "size": [128, 128],
            "description": (
                "Brushed dark metal plate texture — tileable 128×128. "
                "Industrial dark metal surface for Metal Slug-style card variants. "
                "Dark grey (#2B303A / #4A4A4A) with subtle horizontal brushing. "
                "Tough, industrial feel. Must tile seamlessly."
            ),
            "style_constraints": "Tileable. Brushed horizontal grain. Dark metal. Industrial feel.",
            "output_path": "textures/metal_plate.png",
        },
        {
            "id": "wood_grain",
            "category": "texture",
            "model": "gemini",
            "format": "png",
            "size": [128, 128],
            "description": (
                "Dark wood grain texture — tileable 128×128. "
                "Warm dark wood for border/frame elements and podium. "
                "Dark brown (#2D2418) with subtle grain lines in "
                "sepia (#C8B098). Must tile seamlessly."
            ),
            "style_constraints": "Tileable. Dark wood grain. Warm organic feel. Subtle grain lines.",
            "output_path": "textures/wood_grain.png",
        },

        # ═══════════════════════════════════════════════════════════
        # SOUND PARAMETERS (P0) — Pre-defined jsfxr params
        # ═══════════════════════════════════════════════════════════
        {
            "id": "sfx_params",
            "category": "sound",
            "model": "deepseek",  # For manifest generation
            "format": "json",
            "size": None,
            "description": "jsfxr parameter presets for 9 8-bit arcade sound effects.",
            "style_constraints": "Already defined in jsfxr_params.py — this is a manifest entry only.",
            "output_path": "sounds/sfx_params.json",
        },
    ]


def get_assets_by_model(model: str) -> List[AssetDef]:
    """Filter assets by target model.

    Args:
        model: 'deepseek' or 'gemini'

    Returns:
        Filtered list of AssetDef dictionaries
    """
    return [a for a in get_all_assets() if a.get("model") == model]


def get_assets_by_category(category: str) -> List[AssetDef]:
    """Filter assets by category.

    Args:
        category: 'icon', 'sprite', 'expression', 'texture', 'sound'

    Returns:
        Filtered list of AssetDef dictionaries
    """
    return [a for a in get_all_assets() if a.get("category") == category]


def get_asset_by_id(asset_id: str) -> AssetDef:
    """Get a single asset definition by ID.

    Args:
        asset_id: e.g., 'tab_home', 'grade_s', 'cyclist_sheet'

    Returns:
        AssetDef dictionary

    Raises:
        KeyError if asset_id not found
    """
    for asset in get_all_assets():
        if asset["id"] == asset_id:
            return asset
    available = ", ".join(a["id"] for a in get_all_assets())
    raise KeyError(f"Unknown asset ID: '{asset_id}'. Available: {available}")


def list_asset_ids() -> List[str]:
    """Return all asset IDs in definition order."""
    return [a["id"] for a in get_all_assets()]


# ─── Summary statistics ───────────────────────────────────────────

def print_summary():
    """Print a summary of all defined assets."""
    all_assets = get_all_assets()
    deepseek_assets = get_assets_by_model("deepseek")
    gemini_assets = get_assets_by_model("gemini")

    icons = get_assets_by_category("icon")
    sprites = get_assets_by_category("sprite")
    expressions = get_assets_by_category("expression")
    textures = get_assets_by_category("texture")
    sounds = get_assets_by_category("sound")

    print("=" * 60)
    print("SPORT Asset Definitions Summary")
    print("=" * 60)
    print(f"Total assets:        {len(all_assets)}")
    print(f"  -> DeepSeek v4 Pro: {len(deepseek_assets)} (SVG icons, manifest)")
    print(f"  -> Gemini 3:        {len(gemini_assets)} (sprites, textures, expressions)")
    print()
    print(f"By category:")
    print(f"  Icons:       {len(icons)}")
    print(f"  Sprites:     {len(sprites)}")
    print(f"  Expressions: {len(expressions)}")
    print(f"  Textures:    {len(textures)}")
    print(f"  Sounds:      {len(sounds)}")
    print()

    # Calculate output sizes
    svg_count = len([a for a in all_assets if a.get("format") == "svg"])
    png_count = len([a for a in all_assets if a.get("format") == "png"])
    json_count = len([a for a in all_assets if a.get("format") == "json"])
    print(f"Output formats:")
    print(f"  SVG:  {svg_count}")
    print(f"  PNG:  {png_count}")
    print(f"  JSON: {json_count}")
    print("=" * 60)
