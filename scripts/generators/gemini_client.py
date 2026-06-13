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

import io
import logging
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image

_SCRIPT_DIR = Path(__file__).resolve().parent.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from nano_banana_prompts import (  # noqa: E402
    REFERENCE_PNG,
    build_prompt,
    character_lock_path,
)

logger = logging.getLogger(__name__)

NANO_BANANA_PRO = "gemini-3-pro-image"
NANO_BANANA_2 = "gemini-3.1-flash-image"
NANO_BANANA = "gemini-2.5-flash-image"
IMAGEN_MODEL = "imagen-4.0-fast-generate-001"


class GeminiClient:
    MAX_RETRIES = 3
    RETRY_DELAYS = (3.0, 8.0, 15.0)

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
        self._ref_part: Any | None = None
        backend = f"Imagen 4 ({IMAGEN_MODEL})" if self.use_imagen else f"Nano Banana ({self.image_model})"
        logger.info("Image backend ready: %s", backend)

    def generate_image(self, d: dict[str, Any]) -> bytes:
        w, h = d.get("size", [64, 64])
        if d.get("category") == "sprite" and d.get("frames"):
            frames = int(d["frames"])
            fw = int(d.get("frame_width", 64))
            fh = int(d.get("frame_height", 64))
            w, h = frames * fw, fh
        return self._gen(d, w, h)

    def generate_sprite_sheet(self, d: dict[str, Any]) -> bytes:
        """Alias — SSOT prompts already describe sheet layout; no legacy description injection."""
        return self.generate_image(d)

    def _gen(self, d: dict[str, Any], target_w: int, target_h: int) -> bytes:
        prompt = build_prompt(d, strict=True)
        asset_id = d.get("id", "?")
        logger.debug("Prompt for %s (%d chars):\n%s", asset_id, len(prompt), prompt[:500])

        last_error: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                png = (
                    self._gen_imagen(prompt)
                    if self.use_imagen
                    else self._gen_nano_banana(prompt, asset_id=asset_id)
                )
                if png:
                    fitted = self._fit_pixel_art(png, target_w, target_h)
                    logger.info(
                        "Generated %s -> %dx%d (%d bytes raw, %d bytes fitted)",
                        asset_id,
                        target_w,
                        target_h,
                        len(png),
                        len(fitted),
                    )
                    return fitted
                last_error = RuntimeError("API returned no image bytes")
            except Exception as exc:
                last_error = exc
                logger.warning("Attempt %d/%d failed for %s: %s", attempt + 1, self.MAX_RETRIES, asset_id, exc)
                if attempt < self.MAX_RETRIES - 1:
                    time.sleep(self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)])

        raise RuntimeError(f"Nano Banana failed for {asset_id} after {self.MAX_RETRIES} attempts: {last_error}")

    def _reference_part(self) -> Any | None:
        if self.use_imagen or not REFERENCE_PNG.exists():
            return None
        if self._ref_part is not None:
            return self._ref_part
        from google.genai import types

        ref_bytes = REFERENCE_PNG.read_bytes()
        self._ref_part = types.Part.from_bytes(data=ref_bytes, mime_type="image/png")
        logger.info("Attached reference: %s", REFERENCE_PNG.name)
        return self._ref_part

    def _gen_nano_banana(self, prompt: str, asset_id: str = "") -> bytes | None:
        """Gemini native image generation — reference sheet + optional character lock."""
        from google.genai import types

        ref = self._reference_part()
        if ref is None:
            raise RuntimeError(f"Reference PNG missing: {REFERENCE_PNG}")

        contents: list[Any] = [ref]
        lock = character_lock_path(asset_id) if asset_id else None
        if lock is not None:
            lock_bytes = lock.read_bytes()
            contents.append(types.Part.from_bytes(data=lock_bytes, mime_type="image/png"))
            logger.info("Attached character lock: %s -> %s", asset_id, lock.name)

        contents.append(prompt)

        response = self._c.models.generate_content(
            model=self.image_model,
            contents=contents,
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
                        import base64

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
    def _fit_pixel_art(data: bytes, target_w: int, target_h: int) -> bytes:
        """Center-crop to target aspect ratio, then nearest-neighbor resize to exact px."""
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        src_w, src_h = img.size
        if (src_w, src_h) == (target_w, target_h):
            return GeminiClient._save_png(img)

        logger.info("Fitting API output %dx%d -> %dx%d", src_w, src_h, target_w, target_h)
        target_ar = target_w / target_h
        src_ar = src_w / src_h

        if abs(src_ar - target_ar) > 0.05:
            if src_ar > target_ar:
                new_w = max(1, int(src_h * target_ar))
                left = (src_w - new_w) // 2
                img = img.crop((left, 0, left + new_w, src_h))
            else:
                new_h = max(1, int(src_w / target_ar))
                top = (src_h - new_h) // 2
                img = img.crop((0, top, src_w, top + new_h))

        if img.size != (target_w, target_h):
            img = img.resize((target_w, target_h), Image.NEAREST)
        return GeminiClient._save_png(img)

    @staticmethod
    def _save_png(img: Image.Image) -> bytes:
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
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
            ref = self._reference_part()
            from google.genai import types

            self._c.models.generate_content(
                model=self.image_model,
                contents=[ref, "1x1 red pixel art square"],
                config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
            )
            return True
        except Exception:
            return False
