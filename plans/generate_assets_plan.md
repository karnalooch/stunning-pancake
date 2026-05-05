# Generate Assets Script — Implementation Plan

> **Based on:** [`mobile-asset-enhancement-proposal.md`](plans/mobile-asset-enhancement-proposal.md)
> **Models:** DeepSeek v4 Pro (`deepseek-chat`) + Gemini 3 (latest)
> **Target:** SPORT cycling app (rowerzyści)

---

## 1. Model Routing Strategy

| Asset Category | Model | Why |
|---|---|---|
| **SVG icons** (tab bar, grade badges, power-up, currency) | **DeepSeek v4 Pro** | SVG = XML code. DeepSeek excels at precise, constraint-driven code generation. |
| **Sprite sheets** (cyclist, ghost — multi-frame) | **Gemini 3** | Image generation. Multi-frame pixel-art cyclist sprites need visual creativity. |
| **Pixel-art textures** (parchment grain, metal plate, wood grain) | **Gemini 3** | Tileable texture generation needs image output. |
| **Avatar expressions** (idle/happy/tired/victory for cyclist) | **Gemini 3** | Character expression art requires visual understanding. |
| **Sound effect parameters** (for jsfxr/sfxr) | **DeepSeek v4 Pro** | Structured JSON parameter generation — deterministic waveform specs. |
| **Asset manifest** (`ASSET_MANIFEST.json`) | **DeepSeek v4 Pro** | Structured metadata generation, documentation. |
| **Prompt refinement/validation** | **DeepSeek v4 Pro** | The script uses DeepSeek to refine prompts before sending to Gemini. |

---

## 2. Cycling-Specific Adjustments

The proposal was generic — this implementation focuses on **cycling**:

- **Tab bar icons**: Home (bike wheel/hub), History (route/trail), Ranking (podium with bike), Rewards (trophy cup), Profile (helmet/visor)
- **Primary sprite**: Cyclist (not runner) — rider on bike, 8 frames
- **Secondary sprite**: Ghost cyclist (for pace comparison)
- **Power-up icons**: Speed boost (winged wheel), Shield (helmet), Double XP (two bikes), GPS lock (compass rose)
- **Avatar expressions**: Cyclist character with helmet, cycling jersey

---

## 3. File Structure

```
scripts/
├── generate_assets.py          # Main entry point (CLI + orchestrator)
├── asset_definitions.py        # Asset specs extracted from proposal
├── generators/
│   ├── __init__.py
│   ├── deepseek_client.py      # DeepSeek v4 Pro API wrapper
│   ├── gemini_client.py        # Gemini 3 API wrapper
│   └── jsfxr_params.py         # Sound effect parameter definitions
└── README.md                   # Usage guide (optional)
```

---

## 4. API Configuration

### DeepSeek v4 Pro
- **Endpoint**: `https://api.deepseek.com/v1` (OpenAI-compatible)
- **Auth**: `Authorization: Bearer $DEEPSEEK_API_KEY`
- **Model**: `deepseek-chat` (v4 pro)
- **Capabilities used**: Chat completions (JSON mode for SVG/manifest, standard for prompt refinement)

### Gemini 3
- **SDK**: `google-generativeai` Python package
- **Auth**: `GOOGLE_API_KEY` env var (already in `.env.example`)
- **Model**: `gemini-2.5-pro` (latest as of May 2026; configurable via env `GEMINI_MODEL`)
- **Capabilities used**: Image generation, text+image understanding

### Env vars
```
DEEPSEEK_API_KEY=sk-...
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-pro      # optional, defaults to latest
DEEPSEEK_MODEL=deepseek-chat      # optional
```

---

## 5. Script Architecture (Detailed)

### `generate_assets.py` — Main orchestrator

```
CLI: python scripts/generate_assets.py [--category CAT] [--dry-run] [--output DIR]

Flow:
1. Load .env via python-dotenv
2. Parse CLI args
3. Load asset definitions from asset_definitions.py
4. For each asset category:
   a. Route to DeepSeek or Gemini based on category
   b. Generate asset
   c. Validate output (SVG: check viewBox, no anti-aliasing attrs; PNG: check dimensions)
   d. Save to output directory
5. Generate ASSET_MANIFEST.json (via DeepSeek)
6. Print summary
```

### `asset_definitions.py` — Asset catalog

Contains structured definitions for all assets from the proposal. Each definition includes:
- `id`: unique identifier (e.g., `tab_home`)
- `category`: `icon` | `sprite` | `texture` | `expression` | `sound`
- `model`: `deepseek` | `gemini`
- `format`: `svg` | `png` | `json`
- `size`: `[width, height]` in pixels
- `description`: detailed cycling-focused description
- `style_constraints`: pixel-art rules specific to this asset
- `color_palette`: which token colors to use
- `output_path`: relative path under `assets/generated/`

### `generators/deepseek_client.py`

```python
class DeepSeekClient:
    def __init__(self, api_key, model="deepseek-chat"):
        # OpenAI-compatible client
    
    def generate_svg(self, definition: AssetDef) -> str:
        # Generates SVG code with pixel-art constraints
        # Uses JSON mode for structured output:
        # { "svg": "<svg>...</svg>", "metadata": {...} }
    
    def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        # Generic structured JSON generation
    
    def refine_prompt(self, raw_prompt: str) -> str:
        # Takes a basic asset description and adds pixel-art constraints
        # Returns a gemini-optimized prompt
```

### `generators/gemini_client.py`

```python
class GeminiClient:
    def __init__(self, api_key, model="gemini-2.5-pro"):
        # google-generativeai SDK
    
    def generate_image(self, definition: AssetDef) -> bytes:
        # Generates pixel-art PNG image
        # Uses the refined prompt from DeepSeek
        # Returns raw PNG bytes
    
    def generate_sprite_sheet(self, definition: AssetDef) -> bytes:
        # Generates multi-frame sprite sheet
        # e.g., 512×64 for 8 frames of 64×64
```

### `generators/jsfxr_params.py`

Contains predefined jsfxr parameter sets for 9 sound effects:
- UI Click, Mission Start, Mission Complete, Achievement Unlock, Level Up, Error/Buzz, Tab Switch, Coin Pickup, Explosion Burst

Each defined as a JSON dict with jsfxr parameters (waveform, frequency, attack, sustain, etc.)

---

## 6. Asset Catalog (Cycling-Focused)

### Tab Bar Icons (DeepSeek → SVG, 24×24)
| ID | Description |
|----|-------------|
| `tab_home` | Bicycle wheel hub with spokes (hearth/torch replacement — cycling home) |
| `tab_history` | Route trail with waypoints (scroll replacement — activity log) |
| `tab_ranking` | Podium with small bike silhouette (ranking) |
| `tab_rewards` | Trophy cup with bike chain detail (rewards shop) |
| `tab_profile` | Cycling helmet/visor (profile/shield replacement) |

### Grade Badges (DeepSeek → SVG, 32×32)
| ID | Description |
|----|-------------|
| `grade_s` | S-rank: ornate gold badge with bike chain border |
| `grade_a` | A-rank: silver badge |
| `grade_b` | B-rank: bronze badge |
| `grade_c` | C-rank: grey badge |
| `grade_d` | D-rank: red badge |

### Power-Up Icons (DeepSeek → SVG, 24×24)
| ID | Description |
|----|-------------|
| `power_speed` | Winged bicycle wheel (speed boost) |
| `power_shield` | Cycling helmet shield (protection) |
| `power_double_xp` | Two crossed bicycles (double XP) |
| `power_gps` | Compass rose (GPS lock) |

### Currency Icons (DeepSeek → SVG, 16×16)
| ID | Description |
|----|-------------|
| `currency_xp` | Gold cube with "XP" (experience orb) |
| `currency_coin` | Pixel circle with star (gold coin) |
| `currency_energy` | Jagged lightning bolt (energy) |

### Sprite Sheets (Gemini → PNG)
| ID | Description | Dimensions |
|----|-------------|------------|
| `cyclist_sheet` | Cyclist on bike, 8 frames (pedaling animation) | 512×64 |
| `ghost_sheet` | Ghost cyclist, 4 frames (floating pace comparison) | 256×64 |

### Avatar Expressions (Gemini → PNG, 64×64)
| ID | Description |
|----|-------------|
| `cyclist_idle` | Neutral cyclist face with helmet |
| `cyclist_happy` | Happy cyclist — sparkle eyes |
| `cyclist_tired` | Exhausted cyclist — sweat drop |
| `cyclist_victory` | Victory pose — arms up celebrating |

### Textures (Gemini → PNG, 128×128 tileable)
| ID | Description |
|----|-------------|
| `parchment_grain` | Warm paper fiber texture, subtle |
| `metal_plate` | Brushed dark metal (industrial) |
| `wood_grain` | Dark wood grain |

### Sound Parameters (DeepSeek → JSON)
| ID | Description |
|----|-------------|
| `sfx_ui_click` | 8-bit arcade button click |
| `sfx_mission_start` | Rising arpeggio "GO!" |
| `sfx_mission_complete` | Victory fanfare |
| `sfx_achievement` | "Item get" chime |
| `sfx_level_up` | Ascending scale + sparkle |
| `sfx_error` | Low square-wave buzz |
| `sfx_tab_switch` | Soft tick/blip |
| `sfx_coin` | Metallic clink |
| `sfx_explosion` | Chunky 8-bit burst |

---

## 7. Pixel-Art Prompt Constraints (Injected Into Every Request)

```
PIXEL ART RULES (STRICT — NO EXCEPTIONS):
1. 1px solid black (#000000) outlines on all shapes
2. Flat pixel colors only — ZERO anti-aliasing, ZERO gradients, ZERO blur
3. No rounded corners — right angles only (border-radius: 0)
4. Integer pixel positioning — no sub-pixel rendering
5. Colors limited to this palette ONLY:
   - #D4A373 (goldAmber) — primary accent
   - #EDD9B0 (goldLight) — highlight
   - #7BA05B (forestGreen) — success
   - #F5E6CC (cream) — primary text on dark
   - #C8B098 (sepia) — secondary text
   - #0B1D33 (deepSea) — dark background
   - #2D2418 (parchment) — elevated surface
   - #CC4444 (error) — danger
   - #E8A840 (warning) — amber
   - #A0A0A0 (silver) — neutral
   - #4A4A4A (industrial) — dark grey
   - #000000 (pixelBlack) — outlines
   - #2B303A (metalGray) — card surfaces
6. NEVER use #00D1FF (cyan) except for hologram borders
7. Design for CYCLING context — bikes, wheels, helmets, routes, chains, gears
8. Octopath HD-2D aesthetic — warm parchment, gold, deep sea blue
```

---

## 8. Output Directory Structure

```
assets/generated/
├── icons/
│   ├── tab_home.svg
│   ├── tab_history.svg
│   ├── tab_ranking.svg
│   ├── tab_rewards.svg
│   ├── tab_profile.svg
│   ├── grade_s.svg
│   ├── grade_a.svg
│   ├── grade_b.svg
│   ├── grade_c.svg
│   ├── grade_d.svg
│   ├── power_speed.svg
│   ├── power_shield.svg
│   ├── power_double_xp.svg
│   ├── power_gps.svg
│   ├── currency_xp.svg
│   ├── currency_coin.svg
│   └── currency_energy.svg
├── sprites/
│   ├── cyclist_sheet.png
│   └── ghost_sheet.png
├── expressions/
│   ├── cyclist_idle.png
│   ├── cyclist_happy.png
│   ├── cyclist_tired.png
│   └── cyclist_victory.png
├── textures/
│   ├── parchment_grain.png
│   ├── metal_plate.png
│   └── wood_grain.png
├── sounds/
│   └── sfx_params.json
└── ASSET_MANIFEST.json
```

---

## 9. Dependencies

```txt
# requirements.txt (for the script)
python-dotenv>=1.0.0
requests>=2.31.0        # DeepSeek (OpenAI-compatible)
google-generativeai>=0.8.0  # Gemini 3
Pillow>=10.0.0          # PNG validation/resize
```

Install: `pip install python-dotenv requests google-generativeai Pillow`

---

## 10. CLI Usage

```bash
# Generate all assets
python scripts/generate_assets.py

# Generate only icons
python scripts/generate_assets.py --category icons

# Generate only sprites
python scripts/generate_assets.py --category sprites

# Dry run — show what would be generated without API calls
python scripts/generate_assets.py --dry-run

# Custom output directory
python scripts/generate_assets.py --output ./my-assets

# Regenerate specific assets
python scripts/generate_assets.py --asset tab_home,grade_s,cyclist_sheet
```

---

## 11. Error Handling & Resilience

- **API failures**: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- **SVG validation**: Check for `viewBox`, ensure no `style="anti-aliasing"` or similar attrs
- **PNG validation**: Verify dimensions match expected size
- **Rate limiting**: Respect DeepSeek and Gemini rate limits; add delays between batch requests
- **Partial generation**: If one asset fails, continue with the rest; report failures at the end
- **Dry-run mode**: Print all prompts without making API calls — useful for review
- **Resume**: Skip already-generated assets (check file existence)

---

## 12. Prompt Engineering Strategy

For each asset, the flow is:

1. **Base prompt** (from `asset_definitions.py`) — describes the asset in cycling terms
2. **DeepSeek prompt refiner** — DeepSeek takes the base prompt and injects pixel-art constraints, color palette, and exact dimensions → produces final prompt
3. **DeepSeek or Gemini generates** — based on the model routing table

This two-step approach ensures:
- Gemini gets optimized, constraint-heavy prompts (Gemini is weaker at following constraints than DeepSeek)
- DeepSeek handles SVG and JSON directly (its strength)
- Pixel-art rules are consistently applied across all assets

---

*End of plan. Ready for Code mode implementation.*
