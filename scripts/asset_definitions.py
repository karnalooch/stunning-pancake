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

from typing import Any

# ─── Type alias ───────────────────────────────────────────────────
AssetDef = dict[str, Any]

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

def get_all_assets() -> list[AssetDef]:
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
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Bicycle wheel hub with spokes. Pixel-art home icon for cycling app "
                "tab bar. Should look like a detailed bike wheel viewed from the side "
                "— circular hub in center, 4-6 straight spokes radiating outward, "
                "minimal tire outline. Gold (#D4A373) hub and spokes, dark "
                "background (#0B1D33)."
            ),
            "style_constraints": "Symmetrical wheel design. Use goldAmber for active state.",
            "output_path": "icons/tab_home.png",
        },
        {
            "id": "tab_history",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Route trail with waypoint dots. Pixel-art history icon for cycling "
                "activity log. A winding path/route line with small dot waypoints "
                "along it, representing a cycling trail on a map. "
                "Sepia (#C8B098) trail line, cream (#F5E6CC) waypoints."
            ),
            "style_constraints": "Winding path, 3-4 waypoint dots. Clean pixel stepping for the trail.",
            "output_path": "icons/tab_history.png",
        },
        {
            "id": "tab_ranking",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Podium with small bicycle silhouette. Pixel-art leaderboard icon. "
                "Three-tier podium (1st/2nd/3rd place) with a tiny bike outline "
                "on the top step. Gold (#D4A373) 1st place, silver (#A0A0A0) 2nd, "
                "sepia (#C8B098) 3rd."
            ),
            "style_constraints": "Three distinct podium heights. Small bike icon on top.",
            "output_path": "icons/tab_ranking.png",
        },
        {
            "id": "tab_rewards",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Trophy cup with bike chain detail. Pixel-art rewards icon. "
                "A classic trophy cup shape with a small bike chain link pattern "
                "on the cup body. Gold (#D4A373) trophy, goldLight (#EDD9B0) "
                "highlights."
            ),
            "style_constraints": "Trophy silhouette. Chain link pattern on cup body.",
            "output_path": "icons/tab_rewards.png",
        },
        {
            "id": "tab_profile",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Cycling helmet/visor. Pixel-art profile icon. A stylized cycling "
                "helmet viewed from the front — aerodynamic shape with visor and "
                "ventilation slits. Gold (#D4A373) helmet body with "
                "dark (#0B1D33) vents."
            ),
            "style_constraints": "Aerodynamic helmet shape. Visor and vent details.",
            "output_path": "icons/tab_profile.png",
        },

        # ═══════════════════════════════════════════════════════════
        # GRADE BADGES (P0) — DeepSeek SVG, 32×32
        # ═══════════════════════════════════════════════════════════
        {
            "id": "grade_s",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": (
                "S-rank gold badge with ornate border. Top-tier achievement badge "
                "for cycling app. Large bold 'S' letter centered, surrounded by "
                "ornate pixel-art border with bike chain link pattern. "
                "Gold (#D4A373) main color, goldLight (#EDD9B0) highlight, "
                "pixelBlack (#000000) outline."
            ),
            "style_constraints": "Ornate border. Large bold 'S'. Chain link border pattern.",
            "output_path": "icons/grade_s.png",
        },
        {
            "id": "grade_a",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": (
                "A-rank silver badge. Second-tier achievement badge. "
                "Bold 'A' letter centered, silver border. "
                "Silver (#A0A0A0) main color, cream (#F5E6CC) highlight."
            ),
            "style_constraints": "Clean silver badge. Bold 'A' letter.",
            "output_path": "icons/grade_a.png",
        },
        {
            "id": "grade_b",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": (
                "B-rank bronze badge. Third-tier achievement badge. "
                "Bold 'B' letter, warm bronze color using warning (#E8A840)."
            ),
            "style_constraints": "Warm bronze badge. Bold 'B' letter.",
            "output_path": "icons/grade_b.png",
        },
        {
            "id": "grade_c",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": (
                "C-rank grey badge. Lower-tier achievement badge. "
                "Bold 'C' letter, industrial grey color (#4A4A4A)."
            ),
            "style_constraints": "Grey badge. Bold 'C' letter. Simple border.",
            "output_path": "icons/grade_c.png",
        },
        {
            "id": "grade_d",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": (
                "D-rank red badge. Lowest achievement tier. "
                "Bold 'D' letter, error red (#CC4444). Simple border."
            ),
            "style_constraints": "Red badge. Bold 'D' letter. Simple border.",
            "output_path": "icons/grade_d.png",
        },

        # ═══════════════════════════════════════════════════════════
        # POWER-UP ICONS (P1) — DeepSeek SVG, 24×24
        # ═══════════════════════════════════════════════════════════
        {
            "id": "power_speed",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Winged bicycle wheel — speed boost power-up. "
                "A bike wheel with small wings attached to the sides. "
                "Gold (#D4A373) wheel, goldLight (#EDD9B0) wings."
            ),
            "style_constraints": "Wheel + wings combo. Dynamic speed feel.",
            "output_path": "icons/power_speed.png",
        },
        {
            "id": "power_shield",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Cycling helmet as shield — protection power-up. "
                "A helmet shape with shield/defense connotations. "
                "Forest green (#7BA05B) with gold (#D4A373) trim."
            ),
            "style_constraints": "Helmet-as-shield concept. Protective feel.",
            "output_path": "icons/power_shield.png",
        },
        {
            "id": "power_double_xp",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Two crossed bicycles — double XP power-up. "
                "Two small bicycle silhouettes crossing in an X pattern. "
                "Gold (#D4A373) and goldLight (#EDD9B0)."
            ),
            "style_constraints": "Two bikes crossing. Clean recognizable bike silhouette.",
            "output_path": "icons/power_double_xp.png",
        },
        {
            "id": "power_gps",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": (
                "Compass rose — GPS lock power-up. "
                "An 8-point compass star/rose design. "
                "Gold (#D4A373) main points, cream (#F5E6CC) secondary points, "
                "deep sea (#0B1D33) background."
            ),
            "style_constraints": "Compass rose with 4 or 8 points. Navigation feel.",
            "output_path": "icons/power_gps.png",
        },

        # ═══════════════════════════════════════════════════════════
        # CURRENCY ICONS (P1) — DeepSeek SVG, 16×16
        # ═══════════════════════════════════════════════════════════
        {
            "id": "currency_xp",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [16, 16],
            "description": (
                "XP orb — gold cube with 'XP' text. Small pixel-art experience "
                "point icon. A cube shape (isometric 3D pixel look) with tiny "
                "XP lettering or just a star on top. "
                "Gold (#D4A373) cube, goldLight (#EDD9B0) top face."
            ),
            "style_constraints": "Tiny cube, readable at 16px. Gold colors.",
            "output_path": "icons/currency_xp.png",
        },
        {
            "id": "currency_coin",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [16, 16],
            "description": (
                "Gold coin — pixel circle with star center. "
                "A round coin with a small 4-point star in the center. "
                "Gold (#D4A373) rim, goldLight (#EDD9B0) face, "
                "pixelBlack (#000000) outline."
            ),
            "style_constraints": "Round pixel circle. Star in center. Gold colors.",
            "output_path": "icons/currency_coin.png",
        },
        {
            "id": "currency_energy",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [16, 16],
            "description": (
                "Energy bolt — jagged lightning shape. "
                "A sharp, jagged lightning bolt. "
                "Warning amber (#E8A840) body, goldLight (#EDD9B0) highlight."
            ),
            "style_constraints": "Jagged/z字形 lightning. Sharp angles only.",
            "output_path": "icons/currency_energy.png",
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

        # ═══════════════════════════════════════════════════════════
        # ENVIRONMENT PARALLAX (ADR 014) — Gemini PNG
        # ═══════════════════════════════════════════════════════════
        {
            "id": "env_sky_day",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 128],
            "description": (
                "Pixel-art sky band for parallax background — day. Warm cream-to-blue "
                "gradient sky with a few fluffy pixel clouds. Palette: cream #F5E6CC, "
                "forestGreen #7BA05B horizon hint, deepSea #0B1D33 top. No anti-aliasing."
            ),
            "style_constraints": "Horizontal strip, tileable left-right. 1px pixel steps.",
            "output_path": "environment/sky_day.png",
        },
        {
            "id": "env_hills_far",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 96],
            "description": (
                "Distant rolling hills silhouette for parallax layer. Muted forestGreen "
                "#7BA05B and sepia #C8B098. Side-view Cyklo-Siedlce countryside vibe."
            ),
            "style_constraints": "Silhouette hills only. Transparent bottom edge for layering.",
            "output_path": "environment/hills_far.png",
        },
        {
            "id": "env_town_mid",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 128],
            "description": (
                "Mid-ground pixel town: small houses, church spire, cheering crowd dots. "
                "Grand Prix finish-line town aesthetic. goldAmber accents on banners."
            ),
            "style_constraints": "Readable at mobile width. Transparent sky area above rooftops.",
            "output_path": "environment/town_mid.png",
        },
        {
            "id": "env_road_near",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 64],
            "description": (
                "Foreground road strip — asphalt pixel texture with center dashed line. "
                "For parallax bottom layer under cyclist. industrial #4A4A4A road, "
                "goldAmber #D4A373 center dashes."
            ),
            "style_constraints": "Tileable horizontally. Flat perspective road.",
            "output_path": "environment/road_near.png",
        },

        # ═══════════════════════════════════════════════════════════
        # PARTICLES (ADR 014) — Gemini PNG atlas tiles
        # ═══════════════════════════════════════════════════════════
        {
            "id": "particle_atlas",
            "category": "particle",
            "model": "gemini",
            "format": "png",
            "size": [128, 32],
            "frames": 4,
            "frame_width": 32,
            "frame_height": 32,
            "description": (
                "4-tile particle atlas: flame puff, sweat drop, dust puff, heart. "
                "Each 32×32, pixel-art, black 1px outline. For Skia drawAtlas effects."
            ),
            "style_constraints": "4 distinct tiles in a row. No gradients — flat pixels.",
            "output_path": "particles/particle_atlas.png",
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

        {
            "id": "app_icon",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [1024, 1024],
            "description": "App Store icon — caricatured hero on cobblestone street.",
            "style_constraints": "Phase 14 native icon.",
            "output_path": "icon.png",
            "output_base": "mobile/assets",
        },
        {
            "id": "splash_icon",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [1280, 1280],
            "description": "Launch splash — hero mid-race through Siedlce street scene.",
            "style_constraints": "Phase 14 splash.",
            "output_path": "splash-icon.png",
            "output_base": "mobile/assets",
        },
        {
            "id": "adaptive_icon",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [432, 432],
            "description": "Android adaptive icon foreground — hero bust in safe zone.",
            "style_constraints": "Phase 14 adaptive foreground.",
            "output_path": "adaptive-icon.png",
            "output_base": "mobile/assets",
        },
        {
            "id": "favicon",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [48, 48],
            "description": "Web favicon — simplified red helmet on deep sea.",
            "style_constraints": "Phase 14 favicon.",
            "output_path": "favicon.png",
            "output_base": "mobile/assets",
        },
        # ═══════════════════════════════════════════════════════════
        # VISION PARITY (Faza D) — crests, dept icons, achievements,
        # avatar frame, banners, 9-slice frame, sunset/night parallax.
        # Warm Grand Prix palette; pixel-art; hard 1-2px black outline.
        # ═══════════════════════════════════════════════════════════
        *[
            {
                "id": f"crest_{slug}",
                "category": "icon",
                "model": "gemini",
                "format": "png",
                "size": [48, 48],
                "description": (
                    f"Heraldic city crest (herb) of {city}, Poland — pixel-art shield "
                    "emblem for the city list and City Wars. Faithful tinctures, readable "
                    "at 24px. 1-2px black outline, no anti-aliasing."
                ),
                "style_constraints": "48x48 shield. Transparent background. Crisp pixels.",
                "output_path": f"icons/crest_{slug}.png",
            }
            for slug, city in (
                ("gdansk", "Gdańsk"),
                ("katowice", "Katowice"),
                ("lublin", "Lublin"),
                ("siedlce", "Siedlce"),
                ("warszawa", "Warszawa"),
            )
        ],
        *[
            {
                "id": f"dept_{slug}",
                "category": "icon",
                "model": "gemini",
                "format": "png",
                "size": [40, 40],
                "description": f"Department/team pixel icon: {desc}. Forest green + gold accents.",
                "style_constraints": "40x40. Transparent background. 1-2px outline.",
                "output_path": f"icons/dept_{slug}.png",
            }
            for slug, desc in (
                ("it", "laptop with code brackets (IT)"),
                ("marketing", "megaphone (Marketing)"),
                ("hr", "gear with a person silhouette (HR)"),
                ("sales", "trophy cup (Sprzedaż/Sales)"),
            )
        ],
        *[
            {
                "id": f"ach_{slug}",
                "category": "icon",
                "model": "gemini",
                "format": "png",
                "size": [64, 64],
                "description": (
                    f"Hexagonal achievement badge: {desc}. Beveled hex medal, colored "
                    "core, gold rim, pixel-art. Provide a desaturated 'locked' look via "
                    "tint in code."
                ),
                "style_constraints": "64x64 hexagon. Transparent background. Bold readable glyph.",
                "output_path": f"icons/ach_{slug}.png",
            }
            for slug, desc in (
                ("100km", "mountain + '100 KM'"),
                ("10rides", "bicycle + '10 JAZD'"),
                ("500m", "mountain peak + '500 M'"),
                ("kom", "crown + 'KOM'"),
                ("5h", "clock + '5H'"),
                ("endurance", "heart + 'WYTRWAŁOŚĆ'"),
                ("1000kcal", "flame + '1000 KCAL'"),
                ("7days", "sprout + '7 DNI'"),
                ("explorer", "compass + 'ODKRYWCA'"),
                ("passion", "medal + 'PASJA'"),
            )
        ],
        {
            "id": "avatar_frame",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [128, 128],
            "description": (
                "Circular gold laurel avatar frame ring (transparent center) for the "
                "profile portrait, matching vision/12_profile.png."
            ),
            "style_constraints": "128x128. Transparent center + outside. Gold rim + laurel.",
            "output_path": "icons/avatar_frame.png",
        },
        {
            "id": "frame_ornate",
            "category": "texture",
            "model": "gemini",
            "format": "png",
            "size": [96, 96],
            "description": (
                "Ornate parchment scroll frame for 9-slice borders — corner rivets, "
                "wood/gold trim. Used as the standard card/panel border in the vision mocks."
            ),
            "style_constraints": "96x96 with 32px corners for 9-slice. Transparent interior.",
            "output_path": "textures/frame_ornate.png",
        },
        {
            "id": "banner_city_lublin",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 256],
            "description": (
                "City-of-the-week banner — pixel panorama of Lublin old town at day, "
                "with a ribbon area for the city name. Matches vision/05_compete_hub.png."
            ),
            "style_constraints": "512x256 landscape. Leave headroom for overlaid ribbon text.",
            "output_path": "environment/banner_city_lublin.png",
        },
        {
            "id": "finish_meta",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [512, 320],
            "description": (
                "Race finish 'META' scene — checkered banner gantry, cheering crowd with "
                "4VELO flags, cyclist from behind. Matches vision/00_onboarding_finish.png."
            ),
            "style_constraints": "512x320. Warm sunset palette. Crowd as pixel dots.",
            "output_path": "environment/finish_meta.png",
        },
        *[
            {
                "id": f"sky_{slug}",
                "category": "environment",
                "model": "gemini",
                "format": "png",
                "size": [512, 512],
                "description": f"Parallax sky layer — {desc}. Tileable horizontally.",
                "style_constraints": "512x512. Horizontal tile. Matches existing sky_day style.",
                "output_path": f"environment/sky_{slug}.png",
            }
            for slug, desc in (
                ("sunset", "warm orange/pink sunset clouds"),
                ("night", "deep blue night sky with stars"),
            )
        ],
        # ═══════════════════════════════════════════════════════════
        # HUD ACTION ICONS (P2) — stop / pause / play pixel-art
        # ═══════════════════════════════════════════════════════════
        {
            "id": "hud_stop",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": "HUD stop action icon — solid red square pixel-art, 2px black outline.",
            "style_constraints": "24x24. Solid red fill, 2px black border. Single centered subject on transparent background. NO scene/buildings/cyclist.",
            "output_path": "icons/hud_stop.png",
        },
        {
            "id": "hud_pause",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": "HUD pause action icon — two vertical bars pixel-art, 2px black outline.",
            "style_constraints": "24x24. Two vertical 4x12 bars with 3px gap. Single centered subject on transparent background. NO scene/buildings/cyclist.",
            "output_path": "icons/hud_pause.png",
        },
        {
            "id": "hud_play",
            "category": "icon",
            "model": "gemini",
            "format": "png",
            "size": [24, 24],
            "description": "HUD play/resume action icon — right-pointing triangle pixel-art.",
            "style_constraints": "24x24. Right-pointing triangle play symbol, 2px black outline. Single centered subject on transparent background. NO scene/buildings/cyclist.",
            "output_path": "icons/hud_play.png",
        },
        # ═══════════════════════════════════════════════════════════
        # GHOST SPRITE + MAP MARKER (P2)
        # ═══════════════════════════════════════════════════════════
        {
            "id": "ghost_sheet",
            "category": "sprite",
            "model": "gemini",
            "format": "png",
            "size": [256, 64],
            "description": "4-frame ghost cyclist sprite sheet — translucent animated ghost rider for PB/segment replays.",
            "style_constraints": "256x64 4-frame horizontal strip. Semi-transparent pixel cyclist. No scene background.",
            "output_path": "sprites/ghost_sheet.png",
        },
        {
            "id": "map_marker_cyclist",
            "category": "environment",
            "model": "gemini",
            "format": "png",
            "size": [32, 32],
            "description": "Top-down cyclist map marker — pixel-art rider seen from above for map POI.",
            "style_constraints": "32x32. Top-down view of cyclist on bike. Transparent background. No scene.",
            "output_path": "map/marker_cyclist.png",
        },
        # ═══════════════════════════════════════════════════════════
        # SOUND PARAMETERS (P0) — Pre-defined jsfxr params
        # ═══════════════════════════════════════════════════════════
        {
            "id": "sfx_params",
            "category": "sound",
            "model": "local",  # jsfxr presets, no API
            "format": "json",
            "size": None,
            "description": "jsfxr parameter presets for 9 8-bit arcade sound effects.",
            "style_constraints": "Already defined in jsfxr_params.py — this is a manifest entry only.",
            "output_path": "sounds/sfx_params.json",
        },
    ]


def get_assets_by_model(model: str) -> list[AssetDef]:
    """Filter assets by target model.

    Args:
        model: 'deepseek' or 'gemini'

    Returns:
        Filtered list of AssetDef dictionaries
    """
    return [a for a in get_all_assets() if a.get("model") == model]


def get_assets_by_category(category: str) -> list[AssetDef]:
    """Filter assets by category.

    Args:
        category: 'icon', 'sprite', 'expression', 'texture', 'sound', 'environment', 'particle'

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


def list_asset_ids() -> list[str]:
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
    environments = get_assets_by_category("environment")
    particles = get_assets_by_category("particle")
    textures = get_assets_by_category("texture")
    sounds = get_assets_by_category("sound")

    print("=" * 60)
    print("SPORT Asset Definitions Summary")
    print("=" * 60)
    print(f"Total assets:        {len(all_assets)}")
    print(f"  -> DeepSeek v4 Pro: {len(deepseek_assets)} (SVG icons, manifest)")
    print(f"  -> Gemini 3:        {len(gemini_assets)} (sprites, textures, expressions)")
    print()
    print("By category:")
    print(f"  Icons:         {len(icons)}")
    print(f"  Sprites:       {len(sprites)}")
    print(f"  Expressions:   {len(expressions)}")
    print(f"  Environment:   {len(environments)}")
    print(f"  Particles/Map: {len(particles)}")
    print(f"  Textures:      {len(textures)}")
    print(f"  Sounds:        {len(sounds)}")
    print()

    # Calculate output sizes
    svg_count = len([a for a in all_assets if a.get("format") == "svg"])
    png_count = len([a for a in all_assets if a.get("format") == "png"])
    json_count = len([a for a in all_assets if a.get("format") == "json"])
    print("Output formats:")
    print(f"  SVG:  {svg_count}")
    print(f"  PNG:  {png_count}")
    print(f"  JSON: {json_count}")
    print("=" * 60)
