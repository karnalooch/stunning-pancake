"""
DeepSeek v4 Pro API Client

OpenAI-compatible wrapper for DeepSeek's chat completions API.
Used for:
  - SVG icon/badge generation (code generation strength)
  - JSON structured output (manifests, sound parameters)
  - Prompt refinement (prepares Gemini-optimized prompts with pixel-art constraints)
"""

import json
import logging
import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from asset_definitions import AssetDef

import requests

logger = logging.getLogger(__name__)

# ─── Pixel-Art Constraint Template ────────────────────────────────
# Injected into every prompt routed to DeepSeek to ensure
# consistency across all generated SVG assets.

PIXEL_ART_CONSTRAINTS = """
PIXEL ART RULES (STRICT — NO EXCEPTIONS):
1. 1px solid black (#000000) outlines on all shapes.
2. Flat pixel colors only — ZERO anti-aliasing, ZERO gradients, ZERO blur.
3. No rounded corners — right angles only (rx=0, ry=0 on all rects).
4. Integer pixel positioning — no sub-pixel rendering, no fractional coordinates.
5. Colors limited to this palette ONLY:
   - #D4A373 (goldAmber) — primary accent, borders
   - #EDD9B0 (goldLight) — highlight
   - #7BA05B (forestGreen) — success
   - #F5E6CC (cream) — primary light text
   - #C8B098 (sepia) — secondary text
   - #0B1D33 (deepSea) — dark background
   - #2D2418 (parchment) — elevated surface
   - #CC4444 (error) — danger
   - #E8A840 (warning) — amber
   - #A0A0A0 (silver) — neutral
   - #4A4A4A (industrial) — dark grey
   - #000000 (pixelBlack) — outlines
   - #2B303A (metalGray) — surfaces
   - transparent — negative space only
6. NEVER use #00D1FF (cyan) except for hologram card borders only.
7. Design for a CYCLING mobile app (bikes, wheels, helmets, routes, chains, gears, trails).
8. Octopath HD-2D aesthetic — warm parchment, gold, deep sea blue.
9. SVG output must be clean, self-contained, no external references.
10. Use <svg> with correct viewBox matching the requested dimensions.
"""


class DeepSeekClient:
    """OpenAI-compatible client for DeepSeek v4 Pro API.

    Usage:
        client = DeepSeekClient(api_key="sk-...")
        svg = client.generate_svg(definition)
        manifest = client.generate_json(system_prompt, user_prompt)
    """

    BASE_URL = "https://api.deepseek.com/v1"
    DEFAULT_MODEL = "deepseek-chat"
    DEFAULT_MAX_TOKENS = 4096
    DEFAULT_TEMPERATURE = 0.2  # Low temp for deterministic code generation
    MAX_RETRIES = 3
    RETRY_DELAYS = [1.0, 2.0, 4.0]  # Exponential backoff

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key
        self.model = model or self.DEFAULT_MODEL
        self.base_url = base_url or self.BASE_URL

        if not self.api_key:
            raise ValueError(
                "DEEPSEEK_API_KEY is required. Set it in .env or environment."
            )

        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        })

    # ── Public API ────────────────────────────────────────────────

    def generate_svg(self, definition: "AssetDef") -> str:
        """Generate an SVG from an asset definition.

        Args:
            definition: AssetDef with id, description, size, style_constraints

        Returns:
            Raw SVG string
        """
        system_prompt = self._build_svg_system_prompt()
        user_prompt = self._build_svg_user_prompt(definition)
        return self._call_svg(system_prompt, user_prompt)

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """Generate structured JSON output.

        Args:
            system_prompt: System-level instructions
            user_prompt: Specific request
            temperature: Lower = more deterministic

        Returns:
            Parsed JSON dict
        """
        return self._call_json(system_prompt, user_prompt, temperature)

    def refine_prompt(self, raw_description: str) -> str:
        """Take a raw asset description and expand it with pixel-art constraints.

        This produces a Gemini-optimized prompt — DeepSeek is better at
        following constraints, so we use it to produce constraint-heavy
        prompts for Gemini.

        Args:
            raw_description: Basic description of the desired asset

        Returns:
            Expanded prompt with full pixel-art constraints, color palette,
            and cycling-specific context
        """
        system = (
            "You are a prompt engineer for pixel-art asset generation. "
            "Take a simple asset description and expand it into a detailed, "
            "constraint-rich prompt suitable for an image generation model. "
            "Include: exact pixel dimensions, color palette (from SPORT "
            "cycling app tokens), cycling-specific context, pixel-art rules "
            "(1px outlines, no anti-aliasing, flat colors), and the requested "
            "visual style (Octopath HD-2D / Metal Slug arcade). "
            "Output ONLY the final prompt, no commentary."
        )
        user = (
            f"Create a detailed image generation prompt for the following "
            f"cycling app asset:\n\n{raw_description}\n\n"
            f"Include these constraints:\n{PIXEL_ART_CONSTRAINTS}"
        )
        result = self._call_chat(system, user, max_tokens=1024)
        return result.strip()

    def health_check(self) -> bool:
        """Quick check if the API is reachable and authenticated."""
        try:
            self._call_chat(
                "You are a test.", "Reply with just 'OK'.", max_tokens=5
            )
            return True
        except Exception:
            return False

    # ── Private: Prompt Builders ──────────────────────────────────

    def _build_svg_system_prompt(self) -> str:
        return (
            "You are an expert SVG pixel-art designer for a cycling mobile app "
            "called SPORT. Generate clean, self-contained SVG code. "
            "Follow ALL pixel-art constraints precisely. "
            "Output format: JSON with 'svg' (the SVG string) and "
            "'metadata' (description, colors_used, dimensions). "
            "The SVG must have: viewBox matching requested size, "
            "shape-rendering='crispEdges', no external references."
        )

    def _build_svg_user_prompt(self, definition: "AssetDef") -> str:
        w, h = definition.get("size", [24, 24])
        description = definition.get("description", "")
        extra = definition.get("style_constraints", "")
        return (
            f"Generate a pixel-art SVG icon for a cycling mobile app.\n\n"
            f"ASSET: {description}\n"
            f"SIZE: {w}x{h} pixels\n"
            f"ADDITIONAL CONSTRAINTS: {extra}\n\n"
            f"PIXEL ART RULES:\n{PIXEL_ART_CONSTRAINTS}\n\n"
            f"Output ONLY valid JSON with 'svg' and 'metadata' keys. "
            f"The SVG must use viewBox='0 0 {w} {h}' and "
            f"shape-rendering='crispEdges'."
        )

    # ── Private: API Calls ────────────────────────────────────────

    def _call_chat(
        self,
        system: str,
        user: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
    ) -> str:
        """Raw chat completion call with retry logic."""
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        last_error: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                response = self._session.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    timeout=60,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content
            except requests.exceptions.Timeout as e:
                last_error = e
                logger.warning(
                    "DeepSeek timeout (attempt %d/%d)", attempt + 1, self.MAX_RETRIES
                )
            except requests.exceptions.RequestException as e:
                last_error = e
                logger.warning(
                    "DeepSeek request failed (attempt %d/%d): %s",
                    attempt + 1,
                    self.MAX_RETRIES,
                    e,
                )
                # Don't retry on auth errors
                if response is not None and response.status_code in (401, 403):
                    raise

            if attempt < self.MAX_RETRIES - 1:
                delay = self.RETRY_DELAYS[attempt]
                time.sleep(delay)

        raise RuntimeError(
            f"DeepSeek API call failed after {self.MAX_RETRIES} attempts: {last_error}"
        )

    def _call_svg(self, system: str, user: str) -> str:
        """Call chat and extract SVG from response.

        Handles multiple response formats:
          - JSON with 'svg' key
          - Markdown code blocks (```svg, ```xml, ```html)
          - Raw SVG in text
        """
        content = self._call_chat(system, user)

        # Try JSON parse first
        try:
            data = json.loads(content)
            svg = data.get("svg", "")
            if svg:
                return svg
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code blocks
        import re
        for tag in ("svg", "xml", "html"):
            pattern = rf"```{tag}\s*\n(.*?)```"
            match = re.search(pattern, content, re.DOTALL)
            if match:
                return match.group(1).strip()

        # Generic code block
        match = re.search(r"```\s*\n(.*?)```", content, re.DOTALL)
        if match and "<svg" in match.group(1):
            return match.group(1).strip()

        # Extract <svg>...</svg> directly from text
        svg_match = re.search(r"<svg[\s\S]*?</svg>", content)
        if svg_match:
            return svg_match.group(0)

        # Last resort: return raw content
        if "<svg" in content:
            logger.warning("Could not cleanly extract SVG, returning raw content")
            return content

        raise ValueError(
            f"DeepSeek response contained no SVG. "
            f"Response preview: {content[:300]}"
        )

    def _call_json(
        self,
        system: str,
        user: str,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """Call chat and parse JSON response."""
        content = self._call_chat(system, user, temperature=temperature)

        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        if "```json" in content:
            start = content.index("```json") + len("```json")
            end = content.index("```", start)
            json_str = content[start:end].strip()
            return json.loads(json_str)
        if "```" in content:
            start = content.index("```") + 3
            end = content.index("```", start)
            json_str = content[start:end].strip()
            return json.loads(json_str)

        raise ValueError(f"Could not parse JSON from DeepSeek response: {content[:200]}")
