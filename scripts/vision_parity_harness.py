#!/usr/bin/env python3
"""
vision_parity_harness.py — measure UI parity against the vision/ mocks.

Compares each captured screen screenshot against its 1:1 reference in
docs/design/screenshots/2026-06-14-emulator-audit/vision/ using SSIM
(falls back to a normalized pixel-difference score when scikit-image is
absent), then emits a per-screen report, optional side-by-side composites,
and an auto-scored checklist driven by scripts/parity_manifest.json.

The `vision/` references are hand-drawn pixel-art illustrations with
parallax scene backgrounds. We use ROI (region-of-interest) masking from
the per-screen manifest to compare only the UI chrome region, excluding
illustrative backgrounds that a React Native app can never match 1:1.

Usage:
  python scripts/vision_parity_harness.py \\
      --actual <dir-with-NN_name.png> \\
      [--vision docs/design/screenshots/2026-06-14-emulator-audit/vision] \\
      [--out docs/design/screenshots/2026-06-15-parity-progress/diff] \\
      [--threshold 0.6] [--composite] [--report-only]

Metric note: SSIM is a DIRECTIONAL signal (default threshold 0.6); the
human gate is the per-screen checklist (layout/typography/assets/data/empty-state)
written to checklist.md. Use --report-only to never fail the process
(CI trend mode).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VISION = REPO_ROOT / "docs/design/screenshots/2026-06-14-emulator-audit/vision"
DEFAULT_OUT = REPO_ROOT / "docs/design/screenshots/2026-06-15-parity-progress/diff"
MANIFEST_PATH = REPO_ROOT / "scripts" / "parity_manifest.json"

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


# ─── Manifest ────────────────────────────────────────────────────────

def _load_manifest() -> dict:
    """Load the per-screen parity manifest or return empty dict on failure."""
    if not MANIFEST_PATH.exists():
        print(f"[harness] NOTE: no manifest at {MANIFEST_PATH} — using full-frame comparison")
        return {}
    try:
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[harness] WARN: cannot parse manifest ({exc}) — using full-frame comparison")
        return {}


def _get_screen_manifest(manifest: dict, screen_name: str) -> dict:
    """Return the per-screen manifest entry or an empty dict."""
    return manifest.get("screens", {}).get(screen_name.replace(".png", ""), {})


def _apply_roi_mask(img: Image.Image, roi: list[float] | None) -> Image.Image:
    """
    Apply a region-of-interest mask to an image.

    roi is [top%, right%, bottom%, left%] where 0=top/left edge, 100=bottom/right.
    Everything OUTSIDE the ROI is blacked out for SSIM comparison.
    If roi is None or [0, 100, 100, 0], the full frame is compared.
    """
    if roi is None or roi == [0, 100, 100, 0]:
        return img
    w, h = img.size
    top = int(roi[0] * h / 100)
    right = int(roi[1] * w / 100)
    bottom = int(roi[2] * h / 100)
    left = int(roi[3] * w / 100)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rectangle([left, top, right, bottom], fill=255)
    if img.mode != "L":
        img = img.convert("L")
    return Image.composite(img, Image.new("L", img.size, 0), mask)


# ─── Image I/O ───────────────────────────────────────────────────────

def _load_gray(path: Path, size: tuple[int, int]) -> Image.Image:
    return Image.open(path).convert("L").resize(size)


def similarity(actual: Path, vision: Path, roi: list[float] | None = None) -> float:
    """Return a 0..1 similarity score (SSIM if available, else 1 - normalized MAE)."""
    size = (512, 341)  # canonical compare size, mock aspect ~1.5
    a = _load_gray(actual, size)
    b = _load_gray(vision, size)
    if roi is not None:
        a = _apply_roi_mask(a, roi)
        b = _apply_roi_mask(b, roi)
    if _HAS_SSIM:
        return float(ssim(np.asarray(a), np.asarray(b)))
    # Pixel-diff fallback when scikit-image is absent
    aa = np.asarray(a, dtype=np.float64) / 255.0
    bb = np.asarray(b, dtype=np.float64) / 255.0
    mae = float(np.mean(np.abs(aa - bb)))
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
    for im, label in zip(scaled, ("VISION", "ACTUAL"), strict=True):
        canvas.paste(im, (x, label_h + pad))
        draw.text((x, pad), label, fill=(11, 29, 51))
        x += im.width + gap
    draw.text((pad, h + label_h + pad - 2), f"SSIM={score:.3f}", fill=(61, 106, 36))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


# Per-screen checklist dimensions (human gate — the real definition of 1:1).
CHECKLIST_DIMENSIONS = ("layout", "typography", "assets", "data", "empty_state")


def _auto_score_checklist(screen_manifest: dict) -> dict[str, list[str]]:
    """
    Auto-score checklist dimensions from the manifest.
    Returns a dict of dimension -> list of expected sub-items for human review.
    """
    scored: dict[str, list[str]] = {}
    layout = screen_manifest.get("layout", {})
    if layout:
        items = []
        if layout.get("has_header"):
            items.append("header present")
        if layout.get("has_tab_bar"):
            items.append("tab bar")
        cards = layout.get("cards", 0)
        if cards > 0:
            items.append(f"{cards} card(s)")
        sections = layout.get("sections", [])
        if sections:
            items.append(f"sections: {', '.join(sections)}")
        scored["layout"] = items

    typo = screen_manifest.get("typography", {})
    if typo:
        items = []
        for key, val in typo.items():
            if key == "card_count" or key == "label_count":
                items.append(f"{key}: {val}")
            else:
                items.append(str(val))
        scored["typography"] = items

    assets = screen_manifest.get("assets", {})
    if assets:
        items = [k for k, v in assets.items() if v]
        scene = assets.get("scene")
        if scene:
            items.append(f"scene={scene}")
        scored["assets"] = items

    data = screen_manifest.get("data", {})
    if data:
        items = [f"fixtures={data.get('fixtures', 'NONE')}"]
        if data.get("dynamic"):
            items.append("dynamic values")
        scored["data"] = items

    empty = screen_manifest.get("empty_state", False)
    scored["empty_state"] = ["empty-state active" if empty else "no empty-state"]

    return scored


def write_checklist(out_dir: Path, results: list[dict], manifest: dict) -> None:
    """Emit an editable per-screen checklist with auto-scored dimensions."""
    lines = [
        "# Vision parity checklist (human gate)",
        "",
        "SSIM is directional only (mocks are illustrations, ROI-masked comparison).",
        "Mark each dimension [x] when the built screen matches the vision mock.",
        "Auto-filled items come from `scripts/parity_manifest.json`.",
        "",
        "| Screen | SSIM | layout | typography | assets | data | empty-state |",
        "|--------|------|--------|------------|--------|------|-------------|",
    ]
    for r in results:
        score = r["score"] if r["score"] is not None else "—"
        sc = _auto_score_checklist(r.get("manifest", {}))
        layout_hint = ", ".join(sc.get("layout", [])) or "[ ]"
        typo_hint = ", ".join(sc.get("typography", [])) or "[ ]"
        asset_hint = ", ".join(sc.get("assets", [])) or "[ ]"
        data_hint = ", ".join(sc.get("data", [])) or "[ ]"
        empty_hint = ", ".join(sc.get("empty_state", [])) or "[ ]"
        lines.append(f"| {r['screen']} | {score} | {layout_hint} | {typo_hint} | {asset_hint} | {data_hint} | {empty_hint} |")
    (out_dir / "checklist.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--actual", type=Path, help="dir with captured NN_name.png screenshots")
    ap.add_argument("--vision", type=Path, default=DEFAULT_VISION)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--threshold", type=float, default=0.6, help="directional SSIM floor")
    ap.add_argument("--composite", action="store_true")
    ap.add_argument(
        "--report-only",
        action="store_true",
        help="always exit 0 (CI trend mode; checklist is the gate)",
    )
    args = ap.parse_args()

    manifest = _load_manifest()
    roi_available = bool(manifest.get("screens"))

    if roi_available:
        print("[harness] ROI manifest loaded — comparing UI chrome only (parallax backgrounds masked)")

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
        screen_manifest = _get_screen_manifest(manifest, vision_png.name)
        roi = screen_manifest.get("roi") if roi_available else None
        if not actual_png.exists():
            results.append({"screen": vision_png.name, "status": "MISSING", "score": None, "manifest": screen_manifest})
            continue
        score = similarity(actual_png, vision_png, roi=roi)
        worst = min(worst, score)
        results.append({
            "screen": vision_png.name,
            "status": "PASS" if score >= args.threshold else "FAIL",
            "score": round(score, 4),
            "manifest": screen_manifest,
        })
        if args.composite:
            make_composite(actual_png, vision_png, args.out / f"diff_{vision_png.name}", score)

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    lines = ["# Vision parity report", "", "| Screen | Status | SSIM (ROI) |", "|--------|--------|------------|"]
    for r in results:
        lines.append(f"| {r['screen']} | {r['status']} | {r['score'] if r['score'] is not None else '—'} |")
    (args.out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    write_checklist(args.out, results, manifest)

    failed = [r for r in results if r["status"] in {"FAIL", "MISSING"}]
    print(
        f"[harness] {len(results)} screens, "
        f"{len([r for r in results if r['status'] == 'FAIL'])} below directional threshold {args.threshold}, "
        f"{len([r for r in results if r['status'] == 'MISSING'])} missing "
        f"(SSIM is a trend signal; checklist.md is the gate)"
    )
    if args.report_only:
        return 0
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
