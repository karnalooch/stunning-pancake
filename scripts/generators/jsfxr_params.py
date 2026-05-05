"""
SFX parameter presets for jsfxr / sfxr 8-bit sound generator.

These parameters define 9 arcade-style sound effects for the
SPORT cycling app. The presets target the Metal Slug-era chunky
8-bit aesthetic: bold, punchy, immediate.

Each preset is a dictionary of jsfxr-compatible parameters that
can be fed into any sfxr-compatible JavaScript/WebAudio generator
(e.g., https://sfxr.me/).
"""

from typing import Dict, Any

# ─── Type alias ───────────────────────────────────────────────────
SfxPreset = Dict[str, Any]

# ─── All 9 sound effect presets ───────────────────────────────────

SFX_PARAMS: Dict[str, SfxPreset] = {
    # ── UI Click ──────────────────────────────────────────────────
    # Short <100ms square-wave button click
    "ui_click": {
        "description": "8-bit arcade button click — short, square wave, <100ms",
        "category": "ui",
        "waveform": "square",
        "pitch": 0.3,
        "pitchEnd": 0.2,
        "volume": 0.4,
        "attack": 0.0,
        "sustain": 0.0,
        "decay": 0.08,
        "frequency": 1800,
        "vibratoDepth": 0.0,
        "vibratoSpeed": 0.0,
        "duty": 0.5,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 1.0,
        "filterCutoffSweep": 0.0,
        "filterResonance": 0.0,
        "bitCrush": 4,
    },

    # ── Mission Start ─────────────────────────────────────────────
    # Rising 8-bit arpeggio — "GO!" vibe
    "mission_start": {
        "description": "Rising 8-bit arpeggio — Metal Slug mission start 'GO!'",
        "category": "action",
        "waveform": "square",
        "pitch": 0.3,
        "pitchEnd": 0.9,
        "volume": 0.5,
        "attack": 0.0,
        "sustain": 0.1,
        "decay": 0.35,
        "frequency": 440,
        "vibratoDepth": 0.05,
        "vibratoSpeed": 20,
        "duty": 0.5,
        "dutySweep": -0.1,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 0.6,
        "filterCutoffSweep": 0.3,
        "filterResonance": 0.1,
        "bitCrush": 3,
    },

    # ── Mission Complete ──────────────────────────────────────────
    # 8-bit victory fanfare — ascending chord stab + metallic clink
    "mission_complete": {
        "description": "8-bit victory fanfare — ascending chord stab + metallic clink",
        "category": "achievement",
        "waveform": "square",
        "pitch": 0.5,
        "pitchEnd": 1.0,
        "volume": 0.6,
        "attack": 0.0,
        "sustain": 0.15,
        "decay": 0.5,
        "frequency": 523,
        "vibratoDepth": 0.1,
        "vibratoSpeed": 15,
        "duty": 0.4,
        "dutySweep": -0.15,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.1,
        "phaserSweep": -0.1,
        "filterCutoff": 0.5,
        "filterCutoffSweep": 0.4,
        "filterResonance": 0.2,
        "bitCrush": 2,
    },

    # ── Achievement Unlock ────────────────────────────────────────
    # Classic "item get" chime — ascending 3-note blip
    "achievement": {
        "description": "Classic 'item get' chime — ascending 3-note blip",
        "category": "achievement",
        "waveform": "sine",
        "pitch": 0.4,
        "pitchEnd": 0.8,
        "volume": 0.5,
        "attack": 0.0,
        "sustain": 0.05,
        "decay": 0.3,
        "frequency": 660,
        "vibratoDepth": 0.03,
        "vibratoSpeed": 25,
        "duty": 0.5,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 0.8,
        "filterCutoffSweep": 0.0,
        "filterResonance": 0.1,
        "bitCrush": 2,
    },

    # ── Level Up ──────────────────────────────────────────────────
    # Ascending 8-bit scale with sparkle finish
    "level_up": {
        "description": "Ascending 8-bit scale with sparkle finish — short burst",
        "category": "achievement",
        "waveform": "square",
        "pitch": 0.3,
        "pitchEnd": 1.0,
        "volume": 0.55,
        "attack": 0.0,
        "sustain": 0.2,
        "decay": 0.4,
        "frequency": 392,
        "vibratoDepth": 0.08,
        "vibratoSpeed": 18,
        "duty": 0.35,
        "dutySweep": -0.1,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.05,
        "phaserSweep": -0.05,
        "filterCutoff": 0.6,
        "filterCutoffSweep": 0.5,
        "filterResonance": 0.15,
        "bitCrush": 2,
    },

    # ── Error / Buzz ──────────────────────────────────────────────
    # Low square-wave buzz — Metal Slug "miss"
    "error": {
        "description": "Low square-wave buzz — incorrect action, Metal Slug 'miss'",
        "category": "ui",
        "waveform": "square",
        "pitch": 0.15,
        "pitchEnd": 0.1,
        "volume": 0.4,
        "attack": 0.0,
        "sustain": 0.0,
        "decay": 0.2,
        "frequency": 150,
        "vibratoDepth": 0.1,
        "vibratoSpeed": 30,
        "duty": 0.6,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 0.3,
        "filterCutoffSweep": -0.1,
        "filterResonance": 0.0,
        "bitCrush": 6,
    },

    # ── Tab Switch ────────────────────────────────────────────────
    # Soft 8-bit tick/blip
    "tab_switch": {
        "description": "Soft 8-bit tick/blip — barely noticeable tab feedback",
        "category": "ui",
        "waveform": "sine",
        "pitch": 0.6,
        "pitchEnd": 0.5,
        "volume": 0.2,
        "attack": 0.0,
        "sustain": 0.0,
        "decay": 0.05,
        "frequency": 1200,
        "vibratoDepth": 0.0,
        "vibratoSpeed": 0.0,
        "duty": 0.5,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 1.0,
        "filterCutoffSweep": 0.0,
        "filterResonance": 0.0,
        "bitCrush": 3,
    },

    # ── Coin Pickup ───────────────────────────────────────────────
    # Short metallic clink — Metal Slug coin/item pickup
    "coin": {
        "description": "Short metallic clink — Metal Slug coin/item pickup",
        "category": "reward",
        "waveform": "sine",
        "pitch": 0.7,
        "pitchEnd": 0.9,
        "volume": 0.45,
        "attack": 0.0,
        "sustain": 0.0,
        "decay": 0.12,
        "frequency": 2000,
        "vibratoDepth": 0.02,
        "vibratoSpeed": 40,
        "duty": 0.3,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.3,
        "phaserSweep": -0.2,
        "filterCutoff": 0.9,
        "filterCutoffSweep": 0.0,
        "filterResonance": 0.3,
        "bitCrush": 1,
    },

    # ── Explosion Burst ───────────────────────────────────────────
    # Chunky 8-bit explosion — achievement/milestone celebration
    "explosion": {
        "description": "Chunky 8-bit explosion — Metal Slug boss defeat",
        "category": "achievement",
        "waveform": "noise",
        "pitch": 0.1,
        "pitchEnd": 0.0,
        "volume": 0.7,
        "attack": 0.0,
        "sustain": 0.05,
        "decay": 0.45,
        "frequency": 100,
        "vibratoDepth": 0.15,
        "vibratoSpeed": 10,
        "duty": 0.5,
        "dutySweep": 0.0,
        "repeatSpeed": 0.0,
        "phaserOffset": 0.0,
        "phaserSweep": 0.0,
        "filterCutoff": 0.2,
        "filterCutoffSweep": -0.15,
        "filterResonance": 0.05,
        "bitCrush": 8,
    },
}


def get_sfx_param(sfx_id: str) -> SfxPreset:
    """Retrieve a single SFX parameter preset by ID.

    Args:
        sfx_id: e.g. 'ui_click', 'mission_start', 'achievement'

    Returns:
        SfxPreset dict with jsfxr-compatible parameters

    Raises:
        KeyError if sfx_id is not found
    """
    if sfx_id not in SFX_PARAMS:
        available = ", ".join(SFX_PARAMS.keys())
        raise KeyError(
            f"Unknown SFX id: '{sfx_id}'. Available: {available}"
        )
    return SFX_PARAMS[sfx_id]


def list_sfx_ids() -> list[str]:
    """Return all available SFX preset IDs."""
    return list(SFX_PARAMS.keys())


def list_sfx_by_category(category: str) -> list[str]:
    """Return SFX IDs filtered by category.

    Categories: 'ui', 'action', 'achievement', 'reward'
    """
    return [
        sfx_id
        for sfx_id, params in SFX_PARAMS.items()
        if params.get("category") == category
    ]
