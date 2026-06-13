"""
Gemini image generation for SPORT / 4VELO mobile assets.

Backends (GEMINI_USE_IMAGEN):
  - false (default) → Nano Banana — Gemini native image models via Interactions API
      gemini-3-pro-image          Nano Banana Pro (best for Cyklo-Siedlce Grand Prix art)
      gemini-3.1-flash-image      Nano Banana 2 (fast, high volume)
      gemini-2.5-flash-image      Nano Banana (legacy flash)
  - true → Imagen 4 (imagen-4.0-fast-generate-001)

Env:
  GOOGLE_API_KEY       required
  GEMINI_IMAGE_MODEL   Nano Banana model id (default gemini-3-pro-image)
  GEMINI_USE_IMAGEN    true|false
"""

from __future__ import annotations

import base64
import io
import logging
import time
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

PIXEL_ART = """
CRITICAL: Pixel art for retro cycling game "Cyklo-Siedlce Grand Prix".
Flat colors ONLY — NO gradients, NO blur, NO anti-aliasing, NO text labels, NO watermarks.
All shapes: 1px BLACK (#000000) outlines.
Colors ONLY: #D4A373 #EDD9B0 #7BA05B #F5E6CC #C8B098 #0B1D33 #2D2418 #CC4444 #E8A840 #A0A0A0 #4A4A4A #2B303A
ZERO rounded corners. Blocky shapes. Octopath HD-2D + Metal Slug cycling aesthetic.
Polish town Grand Prix vibe: gold banners, church spire, cheering crowd, road bike, gold helmet.
Transparent background unless the asset is a full-bleed sky/texture strip.
"""

# Nano Banana model ids (Gemini native image generation)
NANO_BANANA_PRO = "gemini-3-pro-image"
NANO_BANANA_2 = "gemini-3.1-flash-image"
NANO_BANANA = "gemini-2.5-flash-image"
IMAGEN_MODEL = "imagen-4.0-fast-generate-001"


class GeminiClient:
    MAX_RETRIES = 2
    RETRY_DELAYS = (3.0, 8.0)

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        use_imagen: bool | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("GOOGLE_API_KEY required")
        from google import genai as g2

        self._c = g2.Client(api_key=api_key)
        self.use_imagen = bool(use_imagen)
        self.image_model = model or NANO_BANANA_PRO
        if not self.use_imagen and "image" not in self.image_model and "imagen" not in self.image_model:
            self.image_model = NANO_BANANA_PRO
        backend = f"Imagen 4 ({IMAGEN_MODEL})" if self.use_imagen else f"Nano Banana ({self.image_model})"
        logger.info("Image backend ready: %s", backend)

    def generate_image(self, d: dict[str, Any]) -> bytes:
        return self._gen(d)

    def generate_sprite_sheet(self, d: dict[str, Any]) -> bytes:
        frames = d.get("frames", 4)
        fw = d.get("frame_width", 64)
        fh = d.get("frame_height", 64)
        d2 = dict(d)
        d2["description"] = (
            f"{d.get('description', '')} "
            f"SPRITE SHEET: exactly {frames} animation frames in ONE horizontal row, "
            f"each frame {fw}x{fh}px, total canvas {frames * fw}x{fh}px. "
            f"Frames are evenly spaced side-by-side with NO gaps, NO text, NO labels. "
            f"Same character size and palette in every frame."
        )
        d2["size"] = [frames * fw, fh]
        return self._gen(d2)

    def _gen(self, d: dict[str, Any]) -> bytes:
        w, h = d.get("size", [64, 64])
        prompt = self._prompt(d)
        for attempt in range(self.MAX_RETRIES):
            try:
                png = self._gen_imagen(prompt) if self.use_imagen else self._gen_nano_banana(prompt)
                if png:
                    logger.info("Generated %dx%d (%d bytes)", w, h, len(png))
                    return self._resize(png, w, h)
            except Exception as exc:
                logger.warning("Attempt %d/%d failed: %s", attempt + 1, self.MAX_RETRIES, exc)
                if attempt < self.MAX_RETRIES - 1:
                    time.sleep(self.RETRY_DELAYS[attempt])
        logger.error("All attempts failed — writing placeholder")
        return self._placeholder(w, h)

    def _prompt(self, d: dict[str, Any]) -> str:
        w, h = d.get("size", [64, 64])
        return (
            f"Pixel art asset for CYCLING mobile game Cyklo-Siedlce Grand Prix. "
            f"Output exactly {w}x{h} pixels. "
            f"{d.get('description', '')} "
            f"{d.get('style_constraints', '')} "
            f"{PIXEL_ART}"
        )

    def _gen_nano_banana(self, prompt: str) -> bytes | None:
        """Gemini native image generation (Nano Banana family)."""
        # Preferred: Interactions API (documented for Nano Banana models)
        try:
            interaction = self._c.interactions.create(
                model=self.image_model,
                input=prompt,
            )
            out = getattr(interaction, "output_image", None)
            if out is not None and getattr(out, "data", None):
                return base64.b64decode(out.data)
        except Exception as exc:
            logger.debug("interactions.create failed (%s), trying generate_content", exc)

        # Fallback: generate_content with IMAGE modality
        from google.genai import types

        response = self._c.models.generate_content(
            model=self.image_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )
        return self._bytes_from_content_response(response)

    def _gen_imagen(self, prompt: str) -> bytes | None:
        response = self._c.models.generate_images(
            model=IMAGEN_MODEL,
            prompt=prompt,
            config={"number_of_images": 1},
        )
        if response.generated_images:
            return response.generated_images[0].image.image_bytes
        return None

    @staticmethod
    def _bytes_from_content_response(response: Any) -> bytes | None:
        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and getattr(inline, "data", None):
                    data = inline.data
                    if isinstance(data, str):
                        return base64.b64decode(data)
                    return bytes(data)
                if hasattr(part, "as_image"):
                    try:
                        img = part.as_image()
                        buf = io.BytesIO()
                        img.save(buf, format="PNG")
                        return buf.getvalue()
                    except Exception:
                        pass
        return None

    @staticmethod
    def _resize(data: bytes, w: int, h: int) -> bytes:
        try:
            img = Image.open(io.BytesIO(data)).convert("RGBA")
            if img.size != (w, h):
                img = img.resize((w, h), Image.NEAREST)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
        except Exception:
            return data

    @staticmethod
    def _placeholder(w: int, h: int) -> bytes:
        img = Image.new("RGBA", (w, h), (11, 29, 51, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def health_check(self) -> bool:
        try:
            if self.use_imagen:
                r = self._c.models.generate_images(
                    model=IMAGEN_MODEL,
                    prompt="1x1 red pixel",
                    config={"number_of_images": 1},
                )
                return bool(r.generated_images)
            self._c.interactions.create(
                model=self.image_model,
                input="1x1 red pixel art square",
            )
            return True
        except Exception:
            return False
