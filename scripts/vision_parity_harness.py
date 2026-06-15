#!/usr/bin/env python3
"""
vision_parity_harness.py — measure UI parity against the vision/ mocks.

Compares each captured screen screenshot against its 1:1 reference in
docs/design/screenshots/2026-06-14-emulator-audit/vision/ using SSIM
(falls back to a normalized pixel-difference score when scikit-image is
absent), then emits a per-screen report and optional side-by-side composites.

This is the parity *gate* tool. It is prepared but only meaningful once real
device/emulator screenshots exist (capture step is out of band). Until then,
run with --composite to build before/after panels from any available pair.

Usage:
  python scripts/vision_parity_harness.py \
      --actual <dir-with-NN_name.png> \
      [--vision docs/design/screenshots/2026-06-14-emulator-audit/vision] \
      [--out docs/design/screenshots/2026-06-15-parity-progress/diff] \
      [--threshold 0.92] [--composite]

Exit code is non-zero if any compared screen scores below the threshold.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VISION = REPO_ROOT / "docs/design/screenshots/2026-06-14-emulator-audit/vision"
DEFAULT_OUT = REPO_ROOT / "docs/design/screenshots/2026-06-15-parity-progress/diff"

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - environment guard
    print("[harness] Pillow required: pip install pillow", file=sys.stderr)
    sys.exit(2)

try:
    import numpy as np
    from skimage.metrics import structural_similarity as ssim  # type: ignore

    _HAS_SSIM = True
except ImportError:
    _HAS_SSIM = False


def _load_gray(path: Path, size: tuple[int, int]) -> "Image.Image":
    return Image.open(path).convert("L").resize(size)


def similarity(actual: Path, vision: Path) -> float:
    """Return a 0..1 similarity score (SSIM if available, else 1 - normalized MAE)."""
    size = (512, 341)  # canonical compare size, mock aspect ~1.5
    a = _load_gray(actual, size)
    b = _load_gray(vision, size)
    if _HAS_SSIM:
        return float(ssim(np.asarray(a), np.asarray(b)))
    pa = list(a.getdata())
    pb = list(b.getdata())
    mae = sum(abs(x - y) for x, y in zip(pa, pb)) / (len(pa) * 255.0)
    return 1.0 - mae


def make_composite(actual: Path, vision: Path, out: Path, score: float) -> None:
    h = 480
    imgs = [Image.open(vision).convert("RGB"), Image.open(actual).convert("RGB")]
    scaled = [im.resize((int(im.width * h / im.height), h)) for im in imgs]
    gap, pad, label_h = 16, 16, 28
    width = sum(im.width for im in scaled) + gap + pad * 2
    canvas = Image.new("RGB", (width, h + label_h + pad * 2), (251, 243, 226))
    draw = ImageDraw.Draw(canvas)
    x = pad
    for im, label in zip(scaled, ("VISION", "ACTUAL")):
        canvas.paste(im, (x, label_h + pad))
        draw.text((x, pad), label, fill=(11, 29, 51))
        x += im.width + gap
    draw.text((pad, h + label_h + pad - 2), f"SSIM={score:.3f}", fill=(61, 106, 36))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--actual", type=Path, help="dir with captured NN_name.png screenshots")
    ap.add_argument("--vision", type=Path, default=DEFAULT_VISION)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--threshold", type=float, default=0.92)
    ap.add_argument("--composite", action="store_true")
    args = ap.parse_args()

    if not _HAS_SSIM:
        print("[harness] NOTE: scikit-image not installed — using pixel-diff fallback "
              "(install scikit-image+numpy for true SSIM).")

    if not args.actual:
        print("[harness] No --actual dir provided. Harness is ready; capture device "
              "screenshots (e.g. via Maestro/adb) named NN_name.png to run the gate.")
        return 0

    canonical = sorted(
        p for p in args.vision.glob("*.png")
        if p.name[0].isdigit()  # skip archived iterations
    )
    results: list[dict] = []
    worst = 1.0
    for vision_png in canonical:
        actual_png = args.actual / vision_png.name
        if not actual_png.exists():
            results.append({"screen": vision_png.name, "status": "MISSING", "score": None})
            continue
        score = similarity(actual_png, vision_png)
        worst = min(worst, score)
        results.append({
            "screen": vision_png.name,
            "status": "PASS" if score >= args.threshold else "FAIL",
            "score": round(score, 4),
        })
        if args.composite:
            make_composite(actual_png, vision_png, args.out / f"diff_{vision_png.name}", score)

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    lines = ["# Vision parity report", "", "| Screen | Status | SSIM |", "|--------|--------|------|"]
    for r in results:
        lines.append(f"| {r['screen']} | {r['status']} | {r['score'] if r['score'] is not None else '—'} |")
    (args.out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    failed = [r for r in results if r["status"] == "FAIL"]
    print(f"[harness] {len(results)} screens, {len(failed)} below threshold {args.threshold}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
