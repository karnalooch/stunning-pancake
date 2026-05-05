#!/usr/bin/env python3
"""
SPORT Mobile Asset Enhancement Proposal — Asset Generator
=========================================================

Generates pixel-art assets for the SPORT cycling app using:
  - DeepSeek v4 Pro  → SVG icons, JSON manifests, prompt refinement
  - Gemini 3          → Sprite sheets, textures, avatar expressions

Based on: plans/mobile-asset-enhancement-proposal.md
Plan:     plans/generate_assets_plan.md

Usage:
  python scripts/generate_assets.py                    # Generate ALL assets
  python scripts/generate_assets.py --category icons   # Only icons
  python scripts/generate_assets.py --category sprites # Only sprites
  python scripts/generate_assets.py --dry-run          # Show what would be generated
  python scripts/generate_assets.py --asset tab_home   # Single asset
  python scripts/generate_assets.py --output ./my-dir  # Custom output directory

Environment:
  DEEPSEEK_API_KEY  — DeepSeek v4 Pro API key
  GOOGLE_API_KEY     — Google Gemini API key
  DEEPSEEK_MODEL     — (optional) Override DeepSeek model name
  GEMINI_MODEL       — (optional) Override Gemini model name

Dependencies:
  pip install python-dotenv requests google-generativeai Pillow
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

# ─── Add script directory to path for sibling imports ─────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

# ─── Load .env before imports that may need env vars ──────────────
try:
    from dotenv import load_dotenv
    _ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
    if _ENV_FILE.exists():
        load_dotenv(_ENV_FILE)
        logging.debug("Loaded environment from %s", _ENV_FILE)
except ImportError:
    pass  # python-dotenv is optional

# ─── Project imports ─────────────────────────────────────────────
from asset_definitions import (
    get_all_assets,
    get_assets_by_model,
    get_assets_by_category,
    get_asset_by_id,
    list_asset_ids,
    print_summary as print_asset_summary,
)
from generators import DeepSeekClient, GeminiClient, SFX_PARAMS

# ─── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("generate_assets")

# ─── Constants ───────────────────────────────────────────────────
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "generated"
BATCH_DELAY_SECONDS = 1.0  # Delay between API calls to respect rate limits


# ─── CLI Argument Parser ─────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    """Build the command-line argument parser."""
    parser = argparse.ArgumentParser(
        description="Generate pixel-art assets for the SPORT cycling app.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/generate_assets.py                        # All assets
  python scripts/generate_assets.py --dry-run              # Preview only
  python scripts/generate_assets.py --category icons       # Icons only
  python scripts/generate_assets.py --category sprites     # Sprites only
  python scripts/generate_assets.py --asset tab_home       # Single asset
  python scripts/generate_assets.py --asset tab_home,grade_s,cyclist_sheet
  python scripts/generate_assets.py --skip-existing        # Skip already-generated
  python scripts/generate_assets.py --no-deepseek          # Skip DeepSeek calls
  python scripts/generate_assets.py --no-gemini            # Skip Gemini calls
        """,
    )
    parser.add_argument(
        "--category",
        type=str,
        default=None,
        choices=["icon", "sprite", "expression", "texture", "sound"],
        help="Generate only assets of a specific category.",
    )
    parser.add_argument(
        "--asset",
        type=str,
        default=None,
        help="Comma-separated list of specific asset IDs to generate.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be generated without making API calls.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip assets that already exist in the output directory.",
    )
    parser.add_argument(
        "--no-deepseek",
        action="store_true",
        help="Skip all DeepSeek-dependent assets.",
    )
    parser.add_argument(
        "--no-gemini",
        action="store_true",
        help="Skip all Gemini-dependent assets.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=BATCH_DELAY_SECONDS,
        help=f"Delay in seconds between API calls (default: {BATCH_DELAY_SECONDS})",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug-level logging.",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print asset definition summary and exit.",
    )
    return parser


# ─── Asset Generator Class ──────────────────────────────────────

class AssetGenerator:
    """Orchestrates asset generation across DeepSeek and Gemini APIs.

    Handles:
      - Model routing (deepseek vs gemini based on asset definition)
      - Output directory creation
      - Existing file detection (skip-existing)
      - Dry-run preview
      - Error accumulation and reporting
      - SVG/PNG validation
      - ASSET_MANIFEST.json generation
    """

    def __init__(
        self,
        output_dir: Path,
        dry_run: bool = False,
        skip_existing: bool = False,
        enable_deepseek: bool = True,
        enable_gemini: bool = True,
        batch_delay: float = BATCH_DELAY_SECONDS,
    ):
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.skip_existing = skip_existing
        self.enable_deepseek = enable_deepseek
        self.enable_gemini = enable_gemini
        self.batch_delay = batch_delay

        # Stats
        self.generated: List[str] = []
        self.skipped: List[str] = []
        self.failed: List[Dict[str, str]] = []

        # Clients (lazy initialized)
        self._deepseek: Optional[DeepSeekClient] = None
        self._gemini: Optional[GeminiClient] = None

        # Ensure output directory
        if not self.dry_run:
            self.output_dir.mkdir(parents=True, exist_ok=True)

    # ── Client Properties (lazy init) ────────────────────────────

    @property
    def deepseek(self) -> DeepSeekClient:
        if self._deepseek is None:
            api_key = os.environ.get("DEEPSEEK_API_KEY", "")
            model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
            if not api_key:
                raise RuntimeError(
                    "DEEPSEEK_API_KEY is not set. "
                    "Set it in .env or environment, or use --no-deepseek."
                )
            self._deepseek = DeepSeekClient(api_key=api_key, model=model)
            logger.info("DeepSeek client initialized (model: %s)", model)
        return self._deepseek

    @property
    def gemini(self) -> GeminiClient:
        if self._gemini is None:
            api_key = os.environ.get("GOOGLE_API_KEY", "")
            model = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
            use_imagen = os.environ.get("GEMINI_USE_IMAGEN", "").lower() in (
                "true", "1", "yes", "on"
            )
            if not api_key:
                raise RuntimeError(
                    "GOOGLE_API_KEY is not set. "
                    "Set it in .env or environment, or use --no-gemini."
                )
            self._gemini = GeminiClient(
                api_key=api_key, model=model, use_imagen=use_imagen
            )
            logger.info("Gemini client initialized (model: %s)", model)
        return self._gemini

    # ── Main Generation Loop ─────────────────────────────────────

    def generate_all(self, assets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate all provided assets.

        Args:
            assets: List of AssetDef dictionaries

        Returns:
            Summary dict with counts and paths
        """
        total = len(assets)
        logger.info("Starting generation of %d assets...", total)

        for i, asset in enumerate(assets, 1):
            asset_id = asset["id"]
            model = asset["model"]
            category = asset["category"]

            # Check if this model is enabled
            if model == "deepseek" and not self.enable_deepseek:
                logger.info("[%d/%d] Skipping %s (--no-deepseek)", i, total, asset_id)
                self.skipped.append(asset_id)
                continue
            if model == "gemini" and not self.enable_gemini:
                logger.info("[%d/%d] Skipping %s (--no-gemini)", i, total, asset_id)
                self.skipped.append(asset_id)
                continue

            # Check skip-existing
            output_path = self.output_dir / asset["output_path"]
            if self.skip_existing and output_path.exists():
                logger.info("[%d/%d] Skipping %s (already exists)", i, total, asset_id)
                self.skipped.append(asset_id)
                continue

            logger.info(
                "[%d/%d] Generating %s (%s -> %s)...",
                i, total, asset_id, model, asset["output_path"],
            )

            try:
                self._generate_single(asset)
                self.generated.append(asset_id)
                logger.info("[%d/%d] OK %s generated", i, total, asset_id)
            except Exception as e:
                logger.error("[%d/%d] FAIL %s: %s", i, total, asset_id, e)
                self.failed.append({"id": asset_id, "error": str(e)})

            # Rate limit delay
            if i < total and not self.dry_run:
                time.sleep(self.batch_delay)

        # Generate manifest
        if not self.dry_run and self.generated:
            self._generate_manifest()

        return self._build_summary()

    # ── Single Asset Generation ──────────────────────────────────

    def _generate_single(self, asset: Dict[str, Any]) -> None:
        """Generate a single asset based on its model routing.

        Args:
            asset: AssetDef dictionary
        """
        asset_id = asset["id"]
        model = asset["model"]
        fmt = asset["format"]
        output_path = self.output_dir / asset["output_path"]

        if self.dry_run:
            self._dry_run_preview(asset)
            return

        # Ensure subdirectory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if model == "deepseek" and fmt == "svg":
            self._generate_svg(asset, output_path)
        elif model == "gemini" and fmt == "png":
            self._generate_png(asset, output_path)
        elif asset_id == "sfx_params":
            self._generate_sfx_params(output_path)
        else:
            raise ValueError(
                f"Unknown asset type: model={model}, format={fmt}"
            )

    def _generate_svg(self, asset: Dict[str, Any], output_path: Path) -> None:
        """Generate SVG via DeepSeek."""
        svg_content = self.deepseek.generate_svg(asset)

        # Basic SVG validation
        if "<svg" not in svg_content:
            raise ValueError("DeepSeek did not return valid SVG content")

        output_path.write_text(svg_content, encoding="utf-8")
        logger.debug("  Wrote SVG to %s (%d bytes)", output_path, len(svg_content))

    def _generate_png(self, asset: Dict[str, Any], output_path: Path) -> None:
        """Generate PNG via Gemini."""
        category = asset["category"]

        if category == "sprite":
            png_bytes = self.gemini.generate_sprite_sheet(asset)
        else:
            png_bytes = self.gemini.generate_image(asset)

        output_path.write_bytes(png_bytes)
        logger.debug("  Wrote PNG to %s (%d bytes)", output_path, len(png_bytes))

    def _generate_sfx_params(self, output_path: Path) -> None:
        """Write pre-defined jsfxr sound parameters to JSON."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(SFX_PARAMS, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.debug("  Wrote SFX params to %s", output_path)

    def _dry_run_preview(self, asset: Dict[str, Any]) -> None:
        """Print what would be generated for this asset."""
        size = asset.get("size")
        if size:
            w, h = size
            size_str = f"{w}x{h}"
        else:
            size_str = "N/A"
        print(
            f"  [DRY RUN] {asset['id']:<25s} "
            f"-> {asset['model']:<10s} "
            f"{asset['format']:<4s} "
            f"{size_str:<10s} "
            f"-> {asset['output_path']}"
        )

    # ── Manifest Generation ──────────────────────────────────────

    def _generate_manifest(self) -> None:
        """Generate ASSET_MANIFEST.json describing all generated assets."""
        manifest_path = self.output_dir / "ASSET_MANIFEST.json"

        manifest = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "project": "SPORT Mobile",
            "description": (
                "Auto-generated pixel-art assets for the SPORT cycling app. "
                "Generated via DeepSeek v4 Pro (SVG icons) and "
                "Gemini 3 (sprites, textures, expressions)."
            ),
            "total_assets": len(self.generated),
            "assets": [],
        }

        for asset in get_all_assets():
            asset_id = asset["id"]
            if asset_id not in self.generated:
                continue

            output_path = self.output_dir / asset["output_path"]
            file_size = output_path.stat().st_size if output_path.exists() else 0

            manifest["assets"].append({
                "id": asset_id,
                "category": asset["category"],
                "format": asset["format"],
                "size_px": asset.get("size"),
                "file_size_bytes": file_size,
                "path": asset["output_path"],
                "description": asset.get("description", ""),
            })

        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info("Manifest written to %s", manifest_path)

    # ── Summary ──────────────────────────────────────────────────

    def _build_summary(self) -> Dict[str, Any]:
        """Build a generation summary dict."""
        return {
            "total": len(self.generated) + len(self.skipped) + len(self.failed),
            "generated": len(self.generated),
            "skipped": len(self.skipped),
            "failed": len(self.failed),
            "failed_details": self.failed,
            "generated_ids": self.generated,
            "skipped_ids": self.skipped,
            "output_dir": str(self.output_dir),
            "dry_run": self.dry_run,
        }

    def print_summary(self, summary: Dict[str, Any]) -> None:
        """Print a human-readable summary of the generation results."""
        print()
        print("=" * 60)
        print("SPORT Asset Generation - Summary")
        print("=" * 60)
        mode_label = "DRY RUN (no files written)" if self.dry_run else "LIVE"
        print(f"Mode:       {mode_label}")
        print(f"Output:     {summary['output_dir']}")
        print(f"Total:      {summary['total']} assets")
        print(f"Generated:  {summary['generated']} OK")
        print(f"Skipped:    {summary['skipped']} --")
        print(f"Failed:     {summary['failed']} FAIL")
        print()

        if summary["generated_ids"]:
            print("Generated assets:")
            for aid in summary["generated_ids"]:
                print(f"  OK {aid}")
            print()

        if summary["failed_details"]:
            print("Failed assets:")
            for f in summary["failed_details"]:
                print(f"  FAIL {f['id']}: {f['error']}")
            print()

        if summary["skipped_ids"]:
            print("Skipped assets:")
            for aid in summary["skipped_ids"]:
                print(f"  -- {aid}")
            print()

        print("=" * 60)


# ─── Main Entry Point ────────────────────────────────────────────

def main() -> int:
    """Main CLI entry point.

    Returns:
        Exit code (0 = success, 1 = partial failure, 2 = total failure)
    """
    parser = build_parser()
    args = parser.parse_args()

    # Logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Summary mode
    if args.summary:
        print_asset_summary()
        return 0

    # Determine which assets to generate
    if args.asset:
        asset_ids = [a.strip() for a in args.asset.split(",")]
        assets = [get_asset_by_id(aid) for aid in asset_ids]
    elif args.category:
        assets = get_assets_by_category(args.category)
    else:
        assets = get_all_assets()

    if not assets:
        print("No assets to generate. Check --category or --asset filters.")
        return 0

    # Print what we're about to do
    model_counts: Dict[str, int] = {}
    for a in assets:
        m = a.get("model", "unknown")
        model_counts[m] = model_counts.get(m, 0) + 1

    print(f"\nSPORT Asset Generator")
    print(f"{'-' * 40}")
    print(f"Assets to process: {len(assets)}")
    print(f"  DeepSeek v4 Pro:  {model_counts.get('deepseek', 0)}")
    print(f"  Gemini 3:         {model_counts.get('gemini', 0)}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Output: {args.output}")
    print(f"{'-' * 40}\n")

    # Create generator
    generator = AssetGenerator(
        output_dir=Path(args.output),
        dry_run=args.dry_run,
        skip_existing=args.skip_existing,
        enable_deepseek=not args.no_deepseek,
        enable_gemini=not args.no_gemini,
        batch_delay=args.delay,
    )

    # Run generation
    try:
        summary = generator.generate_all(assets)
        generator.print_summary(summary)

        if summary["failed"] == summary["total"]:
            return 2  # Everything failed
        elif summary["failed"] > 0:
            return 1  # Partial failure
        return 0  # Success

    except KeyboardInterrupt:
        print("\n\nGeneration interrupted by user.")
        return 130
    except Exception as e:
        logger.critical("Fatal error: %s", e, exc_info=args.verbose)
        return 2


if __name__ == "__main__":
    sys.exit(main())
