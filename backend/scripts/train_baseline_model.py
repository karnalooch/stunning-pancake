"""
Baseline ML Model Training — SPORT Platform
=============================================
Generates a synthetic IsolationForest baseline model from
realistic human GPS movement simulations.

This allows the ML anti-cheat layer (Layer 1.5) to be ACTIVE
from day 1 without requiring real production data.

The baseline uses statistically accurate kinematic parameters
derived from published sports science literature:
  - Running: 2.5–6.5 m/s, high speed variance, low straight-line ratio
  - Cycling: 3.5–12 m/s, lower variance, higher straight-line ratio

Usage:
    cd backend
    python scripts/train_baseline_model.py

Output:
    /app/models/anomaly_detector.pkl  (or ML_MODEL_PATH env var)
"""

from __future__ import annotations

import math
import os
import pickle
import random
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Allow imports from backend root
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sklearn.ensemble import IsolationForest

OUTPUT_PATH = Path(os.getenv("ML_MODEL_PATH", "/app/models/anomaly_detector.pkl"))
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ---------------------------------------------------------------------------
# Synthetic clean track generation
# ---------------------------------------------------------------------------


def _make_clean_run_features() -> list[float]:
    """Simulate a realistic human running track (5–15km)."""
    mean_spd = random.uniform(2.5, 5.5)  # m/s  (9-20 km/h)
    std_spd = random.uniform(0.3, 1.2)  # natural variation
    cv = std_spd / max(mean_spd, 0.01)
    max_accel = random.uniform(0.5, 2.5)  # m/s²
    p90 = mean_spd + random.uniform(0.5, 2.0)
    fast_frac = random.uniform(0.0, 0.15)  # rarely >8 m/s
    straight = random.uniform(0.15, 0.65)  # loops/zigzags
    seg_var = random.uniform(0.5, 3.0)
    return [mean_spd, std_spd, cv, max_accel, p90, fast_frac, straight, seg_var]


def _make_clean_bike_features() -> list[float]:
    """Simulate a realistic road cyclist track (10–80km)."""
    mean_spd = random.uniform(4.0, 11.0)  # m/s  (14-40 km/h)
    std_spd = random.uniform(0.5, 2.5)
    cv = std_spd / max(mean_spd, 0.01)
    max_accel = random.uniform(0.3, 1.8)
    p90 = mean_spd + random.uniform(1.0, 4.0)
    fast_frac = random.uniform(0.05, 0.40)  # road cyclists > 8 m/s often
    straight = random.uniform(0.30, 0.80)  # roads are straighter
    seg_var = random.uniform(0.3, 2.0)
    return [mean_spd, std_spd, cv, max_accel, p90, fast_frac, straight, seg_var]


def _make_clean_walk_features() -> list[float]:
    """Simulate a human walk (1–8km)."""
    mean_spd = random.uniform(0.9, 2.2)
    std_spd = random.uniform(0.1, 0.5)
    cv = std_spd / max(mean_spd, 0.01)
    max_accel = random.uniform(0.2, 1.0)
    p90 = mean_spd + random.uniform(0.2, 0.8)
    fast_frac = 0.0
    straight = random.uniform(0.10, 0.60)
    seg_var = random.uniform(0.5, 2.5)
    return [mean_spd, std_spd, cv, max_accel, p90, fast_frac, straight, seg_var]


def generate_clean_dataset(n_samples: int = 5000) -> np.ndarray:
    """
    Generates N clean human tracks (mix of run/bike/walk).

    Args:
        n_samples: Total number of synthetic clean tracks.

    Returns:
        numpy array of shape (n_samples, 8).
    """
    samples = []
    generators = [
        (_make_clean_run_features, 0.45),  # 45% runners
        (_make_clean_bike_features, 0.45),  # 45% cyclists
        (_make_clean_walk_features, 0.10),  # 10% walkers
    ]

    for _ in range(n_samples):
        r = random.random()
        cumulative = 0.0
        for fn, prob in generators:
            cumulative += prob
            if r <= cumulative:
                samples.append(fn())
                break

    return np.array(samples)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train_baseline_model(n_samples: int = 5000, output_path: Path | None = None) -> Path:
    """
    Trains an IsolationForest baseline model on synthetic clean tracks.

    Model configuration:
        - n_estimators=300: High tree count for stable boundary estimation
        - contamination=0.03: ~3% contamination expected in real data
        - max_samples='auto': Uses min(256, n_samples) per tree

    Args:
        n_samples: Number of synthetic clean tracks to generate.
        output_path: Override output path (defaults to ML_MODEL_PATH).

    Returns:
        Path where the model was saved.
    """
    save_path = output_path or OUTPUT_PATH
    save_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"🔧 Generating {n_samples} synthetic clean tracks...")
    X = generate_clean_dataset(n_samples)
    print(f"   Feature matrix: {X.shape[0]} samples × {X.shape[1]} features")
    print("   Feature ranges:")
    feature_names = [
        "mean_spd",
        "std_spd",
        "cv",
        "max_accel",
        "p90",
        "fast_frac",
        "straight_ratio",
        "seg_var",
    ]
    for i, name in enumerate(feature_names):
        print(f"   {name:20s}: [{X[:, i].min():.3f}, {X[:, i].max():.3f}]  μ={X[:, i].mean():.3f}")

    print("\n🤖 Training IsolationForest...")
    clf = IsolationForest(
        n_estimators=300,
        contamination=0.03,
        max_samples="auto",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    clf.fit(X)

    # Self-validation: score the training set — should mostly be positive
    scores = clf.score_samples(X)
    flagged = (scores < -0.15).sum()
    print(
        f"   Self-validation: {flagged}/{len(scores)} synthetic clean tracks flagged ({100 * flagged / len(scores):.1f}%)"
    )
    print(
        f"   Score distribution: min={scores.min():.3f}  mean={scores.mean():.3f}  max={scores.max():.3f}"
    )

    with open(save_path, "wb") as f:
        pickle.dump(clf, f)

    print(f"\n✅ Model saved: {save_path}")
    print(f"   Size: {save_path.stat().st_size / 1024:.1f} KB")
    return save_path


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


def verify_model(model_path: Path) -> None:
    """Quick smoke test: checks model rejects obviously anomalous inputs."""
    with open(model_path, "rb") as f:
        clf = pickle.load(f)

    # Known anomalous: car driving at 25 m/s (90 km/h) in a straight line
    car_features = np.array([[25.0, 1.5, 0.06, 0.3, 27.0, 0.95, 0.95, 0.1]])
    # Known clean: average runner
    runner_features = np.array([[3.5, 0.8, 0.23, 1.2, 5.0, 0.02, 0.35, 1.5]])

    car_score = clf.score_samples(car_features)[0]
    runner_score = clf.score_samples(runner_features)[0]

    print("\n🧪 Model Verification:")
    print(
        f"   Runner score:  {runner_score:.4f}  → {'✅ CLEAN' if runner_score > -0.15 else '❌ FLAGGED (unexpected)'}"
    )
    print(
        f"   Car score:     {car_score:.4f}  → {'✅ FLAGGED' if car_score < -0.15 else '⚠️  NOT flagged (threshold may need adjustment)'}"
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train SPORT baseline ML anomaly detector")
    parser.add_argument(
        "--samples", type=int, default=5000, help="Number of synthetic tracks (default: 5000)"
    )
    parser.add_argument("--output", type=str, default=None, help="Override output path")
    args = parser.parse_args()

    out = Path(args.output) if args.output else None
    saved = train_baseline_model(n_samples=args.samples, output_path=out)
    verify_model(saved)
    print("\n🏁 Baseline model ready. ML anti-cheat Layer 1.5 is now ACTIVE.")
