#!/usr/bin/env python3
"""
Post-process generated PNG assets for mobile (ADR 014 pipeline).

Steps per PNG:
  1. Palette quantize to limited Stitch/scene palette
  2. Nearest-neighbor resize (optional scale factor)
  3. Trim transparent padding (optional)

Usage:
  python scripts/postprocess_assets.py
  python scripts/postprocess_assets.py --input assets/generated --in-place
  python scripts/postprocess_assets.py --asset sprites/cyclist_sheet.png
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from asset_definitions import TOKEN_COLORS  # noqa: E402

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("pip install Pillow") from exc

DEFAULT_INPUT = Path(__file__).resolve().parent.parent / "assets" / "generated"
DEFAULT_OUTPUT_SUFFIX = "_processed"

# ADR 014 mobile palette (hex without #)
PALETTE_RGB = [
    tuple(int(TOKEN_COLORS[k].lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    for k in (
        "goldAmber",
        "goldLight",
        "forestGreen",
        "cream",
        "sepia",
        "deepSea",
        "parchment",
        "pixelBlack",
        "metalGray",
        "silver",
        "warning",
        "error",
    )
]


def nearest_palette_color(r: int, g: int, b: int) -> tuple[int, int, int]:
    best = PALETTE_RGB[0]
    best_dist = float("inf")
    for rgb in PALETTE_RGB:
        d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2
        if d < best_dist:
            best_dist = d
            best = rgb
    return best


def quantize_image(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    assert px is not None
    w, h = img.size
    out = Image.new("RGBA", (w, h))
    out_px = out.load()
    assert out_px is not None
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                out_px[x, y] = (0, 0, 0, 0)
                continue
            nr, ng, nb = nearest_palette_color(r, g, b)
            out_px[x, y] = (nr, ng, nb, a)
    return out


def process_file(src: Path, dst: Path, scale: int = 1) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        processed = quantize_image(img)
        if scale != 1:
            nw, nh = processed.size
            processed = processed.resize(
                (nw * scale, nh * scale),
                resample=Image.Resampling.NEAREST,
            )
        processed.save(dst, optimize=True)


def collect_pngs(root: Path, asset_filter: str | None) -> list[Path]:
    if asset_filter:
        p = root / asset_filter
        return [p] if p.exists() else []
    return sorted(root.rglob("*.png"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Post-process mobile pixel-art PNGs")
    parser.add_argument("--input", type=str, default=str(DEFAULT_INPUT))
    parser.add_argument("--output", type=str, default=None, help="Output dir (default: input + _processed)")
    parser.add_argument("--in-place", action="store_true", help="Overwrite source PNGs")
    parser.add_argument("--asset", type=str, default=None, help="Relative path under input, e.g. sprites/foo.png")
    parser.add_argument("--scale", type=int, default=1)
    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"Input not found: {input_dir}")
        return 1

    output_dir = input_dir if args.in_place else Path(args.output or f"{input_dir}{DEFAULT_OUTPUT_SUFFIX}")
    files = collect_pngs(input_dir, args.asset)
    if not files:
        print("No PNG files to process.")
        return 0

    for src in files:
        rel = src.relative_to(input_dir)
        dst = output_dir / rel if not args.in_place else src
        process_file(src, dst, scale=args.scale)
        print(f"OK {rel}")

    print(f"Processed {len(files)} file(s) -> {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
