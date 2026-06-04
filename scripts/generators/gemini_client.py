"""
Imagen 4 Pixel Art Generator for SPORT cycling app.
Uses google-genai SDK with Imagen 4 for all image generation.
"""

import io
import logging
import time

from PIL import Image

logger = logging.getLogger(__name__)

PIXEL_ART = """
CRITICAL: Pixel art for retro cycling game. Flat colors ONLY - NO gradients, NO blur, NO anti-aliasing.
All shapes: 1px BLACK (#000000) outlines.
Colors ONLY: #D4A373 #EDD9B0 #7BA05B #F5E6CC #C8B098 #0B1D33 #2D2418 #CC4444 #E8A840 #A0A0A0 #4A4A4A #2B303A
ZERO rounded corners. Blocky shapes. Octopath HD-2D + Metal Slug style. CYCLING app - bikes, helmets, wheels.
"""

class GeminiClient:
    IMAGEN_MODEL = "imagen-4.0-fast-generate-001"
    MAX_RETRIES, RETRY_DELAYS = 2, [3.0, 6.0]

    def __init__(self, api_key: str, model: str | None = None, use_imagen: bool | None = None):
        if not api_key: raise ValueError("GOOGLE_API_KEY required")
        from google import genai as g2
        self._c = g2.Client(api_key=api_key)
        logger.info("Imagen 4 ready: %s", self.IMAGEN_MODEL)

    def generate_image(self, d): return self._gen(d)
    def generate_sprite_sheet(self, d):
        frames = d.get("frames", 4); fw = d.get("frame_width", 64); fh = d.get("frame_height", 64)
        d2 = dict(d)
        d2["description"] = f"{d.get('description','')} SPRITE SHEET: {frames} frames horizontal row, each {fw}x{fh}px, total {frames*fw}x{fh}px. Frames show animation cycle, separated side by side."
        d2["size"] = [frames * fw, fh]
        return self._gen(d2)

    def _gen(self, d):
        w, h = d.get("size", [64, 64]); prompt = self._p(d)
        for a in range(self.MAX_RETRIES):
            try:
                r = self._c.models.generate_images(model=self.IMAGEN_MODEL, prompt=prompt, config={"number_of_images": 1})
                if r.generated_images:
                    png = r.generated_images[0].image.image_bytes
                    logger.info("Imagen: %dx%d, %d bytes", w, h, len(png))
                    return self._rs(png, w, h)
            except Exception as e:
                logger.warning("Imagen %d/%d: %s", a+1, self.MAX_RETRIES, e)
                if a < self.MAX_RETRIES-1: time.sleep(self.RETRY_DELAYS[a])
        logger.error("Imagen failed, placeholder"); return self._ph(w, h)

    def _p(self, d):
        w, h = d.get("size", [64, 64])
        return f"Pixel art image for CYCLING game SPORT. Exactly {w}x{h} pixels. {d.get('description','')} {d.get('style_constraints','')} {PIXEL_ART}"

    def _rs(self, data, w, h):
        try:
            img = Image.open(io.BytesIO(data))
            if img.size != (w, h): img = img.resize((w, h), Image.NEAREST)
            b = io.BytesIO(); img.save(b, format="PNG", optimize=True); return b.getvalue()
        except: return data

    def _ph(self, w, h):
        img = Image.new("RGBA", (w, h), (11, 29, 51, 255))
        b = io.BytesIO(); img.save(b, format="PNG"); return b.getvalue()

    def health_check(self) -> bool:
        try:
            r = self._c.models.generate_images(model=self.IMAGEN_MODEL, prompt="1x1 red pixel", config={"number_of_images": 1})
            return bool(r.generated_images)
        except: return False
