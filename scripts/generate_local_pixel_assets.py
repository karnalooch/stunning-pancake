#!/usr/bin/env python3
"""Procedural pixel-art placeholders for missing ADR 014 assets (no external API)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit("pip install Pillow") from exc

ROOT = Path(__file__).resolve().parent.parent / "assets" / "generated"

# ADR 014 / stitch palette
PAL = {
    "sky_top": (0x0B, 0x1D, 0x33),
    "sky_mid": (0x7B, 0xA0, 0x5B),
    "sky_low": (0xF5, 0xE6, 0xCC),
    "hill": (0x5A, 0x8A, 0x45),
    "hill_dark": (0x3D, 0x6B, 0x32),
    "town": (0xC8, 0xB0, 0x98),
    "roof": (0xD4, 0xA3, 0x73),
    "road": (0x4A, 0x4A, 0x4A),
    "dash": (0xD4, 0xA3, 0x73),
    "black": (0x19, 0x1D, 0x17),
    "cream": (0xF5, 0xF5, 0xDC),
    "gold": (0xD4, 0xA3, 0x73),
    "flame": (0xE8, 0xA8, 0x40),
    "heart": (0xCC, 0x44, 0x44),
}


def px(draw: ImageDraw.ImageDraw, x: int, y: int, c: tuple[int, int, int], s: int = 1) -> None:
    draw.rectangle([x, y, x + s - 1, y + s - 1], fill=c)


def gradient_sky(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        if t < 0.55:
            r = int(PAL["sky_top"][0] * (1 - t * 0.4) + PAL["sky_mid"][0] * t * 0.4)
            g = int(PAL["sky_top"][1] * (1 - t * 0.4) + PAL["sky_mid"][1] * t * 0.4)
            b = int(PAL["sky_top"][2] * (1 - t * 0.4) + PAL["sky_mid"][2] * t * 0.4)
        else:
            tt = (t - 0.55) / 0.45
            r = int(PAL["sky_mid"][0] * (1 - tt) + PAL["sky_low"][0] * tt)
            g = int(PAL["sky_mid"][1] * (1 - tt) + PAL["sky_low"][1] * tt)
            b = int(PAL["sky_mid"][2] * (1 - tt) + PAL["sky_low"][2] * tt)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
    # pixel clouds
    for cx, cy, cw in [(80, 24, 40), (220, 18, 32), (380, 28, 36), (520, 22, 28)]:
        for i in range(cw):
            px(draw, cx + i, cy, PAL["cream"], 2)
            if i % 3 == 0:
                px(draw, cx + i, cy - 2, PAL["cream"], 2)
    return img


def hills_far(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    base = h - 8
    for x in range(w):
        y = base - int(18 + 12 * abs(((x % 120) / 120) - 0.5) * 2)
        draw.line([(x, y), (x, h)], fill=(*PAL["hill"], 255))
    for x in range(0, w, 4):
        y2 = base - int(8 + 6 * abs(((x % 80) / 80) - 0.5) * 2)
        px(draw, x, y2, PAL["hill_dark"], 2)
    return img


def town_mid(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    ground = h - 20
    # houses
    specs = [(20, 50, 36, 28), (70, 42, 44, 36), (130, 48, 32, 26), (180, 38, 40, 38),
             (240, 45, 38, 30), (300, 40, 50, 35), (370, 52, 30, 24), (420, 44, 42, 32),
             (480, 48, 36, 28)]
    for x, rh, bw, bh in specs:
        y = ground - bh
        draw.rectangle([x, y, x + bw, ground], fill=(*PAL["town"], 255), outline=(*PAL["black"], 255))
        # roof
        for i in range(bw // 2):
            px(draw, x + i, y - 4 - i // 2, PAL["roof"], 2)
            px(draw, x + bw - i, y - 4 - i // 2, PAL["roof"], 2)
        # window
        px(draw, x + bw // 3, y + bh // 3, PAL["gold"], 3)
    # church spire
    sx = 350
    for i in range(30):
        px(draw, sx, ground - 50 + i, PAL["roof"], 3)
    px(draw, sx - 6, ground - 52, PAL["gold"], 4)
    # crowd dots
    for x in range(30, w - 20, 18):
        px(draw, x, ground + 2, PAL["black"], 2)
    return img


def road_near(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, h // 3, w, h], fill=(*PAL["road"], 255))
    for x in range(0, w, 24):
        draw.rectangle([x, h // 2, x + 12, h // 2 + 3], fill=(*PAL["dash"], 255))
    draw.line([(0, h // 3), (w, h // 3)], fill=(*PAL["black"], 255), width=2)
    return img


def particle_atlas() -> Image.Image:
    img = Image.new("RGBA", (128, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # flame
    for i, (x, y) in enumerate([(4, 20), (8, 14), (12, 18), (10, 10), (14, 16)]):
        px(draw, x, y, PAL["flame"] if i < 3 else PAL["gold"], 2)
    # sweat
    px(draw, 36, 10, (0x88, 0xCC, 0xFF), 3)
    px(draw, 40, 16, (0x66, 0xAA, 0xEE), 2)
    # dust
    for x, y in [(72, 18), (78, 14), (84, 20), (90, 12)]:
        px(draw, x, y, PAL["town"], 2)
    # heart
    px(draw, 108, 14, PAL["heart"], 2)
    px(draw, 112, 14, PAL["heart"], 2)
    px(draw, 110, 10, PAL["heart"], 2)
    px(draw, 110, 18, PAL["heart"], 2)
    return img


def map_marker() -> Image.Image:
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # wheels
    px(draw, 6, 22, PAL["black"], 4)
    px(draw, 20, 22, PAL["black"], 4)
    # frame
    draw.line([(8, 18), (22, 18)], fill=(*PAL["black"], 255), width=2)
    draw.line([(14, 18), (16, 10)], fill=(*PAL["black"], 255), width=2)
    # rider head
    px(draw, 14, 6, PAL["gold"], 4)
    px(draw, 12, 12, (0x0B, 0x1D, 0x33), 3)
    return img


def main() -> None:
    targets = [
        (ROOT / "environment" / "sky_day.png", gradient_sky(512, 128)),
        (ROOT / "environment" / "hills_far.png", hills_far(512, 96)),
        (ROOT / "environment" / "town_mid.png", town_mid(512, 128)),
        (ROOT / "environment" / "road_near.png", road_near(512, 64)),
        (ROOT / "particles" / "particle_atlas.png", particle_atlas()),
        (ROOT / "map" / "marker_cyclist.png", map_marker()),
    ]
    for path, image in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, optimize=True)
        print(f"OK {path.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()
