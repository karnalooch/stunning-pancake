"""
ML Anomaly Detector — SPORT Platform (Milestone 5)
====================================================
Constitution §24.5: Layer 1.5 Anti-Cheat — Statistical Learning

Sits between the kinematic Fast Selection Gate (Layer 1) and the
V-max biomechanical checks (Layer 2). Uses an Isolation Forest model
to catch anomalous GPS tracks that pass rule-based checks but are
statistically inconsistent with known human movement patterns.

Design principles:
- No network I/O — pure NumPy/scikit-learn in-memory computation.
- Degrades gracefully if scikit-learn is not installed (falls back to None).
- Model is trained offline and saved to disk; loaded lazily on first call.
- Feature vector is interpretable: 8 kinematic features per track.
"""
from __future__ import annotations

import logging
import math
import os
import pickle
import statistics
import threading
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from activities.signal_processing import GpsPoint

logger = logging.getLogger(__name__)

# Path where the trained IsolationForest model is stored
MODEL_PATH = Path(os.getenv("ML_MODEL_PATH", "/app/models/anomaly_detector.pkl"))

# Default anomaly score threshold (fallback if not dynamically trained)
ANOMALY_THRESHOLD = float(os.getenv("ML_ANOMALY_THRESHOLD", "-0.15"))

# Minimum track length for ML analysis (too few points = unreliable)
MIN_POINTS_FOR_ML = 20

_model_payload = None   # Lazy-loaded dict containing model and thresholds
_model_loaded = False
_model_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in metres between two WGS-84 coordinates."""
    R = 6_371_000.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def extract_features(points: list["GpsPoint"]) -> list[float] | None:
    """
    Extracts an 8-dimensional feature vector from a GPS track.

    Features:
        0. Mean speed (m/s)
        1. Std dev of speed
        2. Speed coefficient of variation (std/mean)
        3. Max acceleration (m/s²)
        4. 90th percentile speed
        5. Fraction of segments with speed > 8 m/s (28.8 km/h, cycling threshold)
        6. Straight-line ratio (displacement / total distance)
        7. Segment length variance (normalised)

    Returns:
        List of 8 floats, or None if track is too short.
    """
    if len(points) < MIN_POINTS_FOR_ML:
        return None

    speeds: list[float] = []
    accels: list[float] = []
    distances: list[float] = []
    prev_speed = None
    prev_time = None

    for i in range(1, len(points)):
        p0, p1 = points[i - 1], points[i]
        dt = max(p1.timestamp - p0.timestamp, 0.01)
        d = _haversine_m(p0.lat, p0.lon, p1.lat, p1.lon)
        spd = d / dt
        speeds.append(spd)
        distances.append(d)
        if prev_speed is not None and prev_time is not None:
            accels.append(abs(spd - prev_speed) / max(dt, 0.01))
        prev_speed = spd
        prev_time = dt

    if not speeds:
        return None

    mean_spd = statistics.mean(speeds)
    std_spd = statistics.pstdev(speeds)
    cv = std_spd / max(mean_spd, 0.01)
    max_accel = max(accels) if accels else 0.0

    sorted_spd = sorted(speeds)
    p90 = sorted_spd[int(len(sorted_spd) * 0.9)]

    fast_fraction = sum(1 for s in speeds if s > 8.0) / len(speeds)

    # Straight-line ratio
    total_dist = sum(distances)
    if total_dist > 0:
        p0, pN = points[0], points[-1]
        displacement = _haversine_m(p0.lat, p0.lon, pN.lat, pN.lon)
        straight_ratio = displacement / total_dist
    else:
        straight_ratio = 0.0

    # Segment variance (normalised by mean distance)
    seg_var = statistics.pvariance(distances) / max(statistics.mean(distances) ** 2, 0.0001)

    return [mean_spd, std_spd, cv, max_accel, p90, fast_fraction, straight_ratio, seg_var]


# ---------------------------------------------------------------------------
# Model I/O
# ---------------------------------------------------------------------------

def _load_model():
    """Lazily loads the IsolationForest model payload from disk (Thread-safe)."""
    global _model_payload, _model_loaded
    
    if _model_loaded:
        return _model_payload

    with _model_lock:
        if _model_loaded:
            return _model_payload
            
        _model_loaded = True
        if not MODEL_PATH.exists():
            logger.info("ml_anomaly: model file not found at %s — ML check disabled", MODEL_PATH)
            return None

        try:
            import joblib
            payload = joblib.load(MODEL_PATH)
            if not isinstance(payload, dict):
                # Backwards compatibility for older pickled models
                _model_payload = {"model": payload, "dynamic_threshold": ANOMALY_THRESHOLD}
            else:
                _model_payload = payload
            logger.info("ml_anomaly: model loaded from %s (joblib)", MODEL_PATH)
        except ImportError:
            # Fallback to pickle if joblib is not available yet
            import pickle
            with open(MODEL_PATH, "rb") as f:
                payload = pickle.load(f)
                if not isinstance(payload, dict):
                    _model_payload = {"model": payload, "dynamic_threshold": ANOMALY_THRESHOLD}
                else:
                    _model_payload = payload
            logger.warning("ml_anomaly: loaded via pickle (joblib recommended)")
        except Exception as exc:
            logger.error("ml_anomaly: failed to load model err=%s", exc)
            _model_payload = None

    return _model_payload


def train_and_save_model(clean_tracks: list[list["GpsPoint"]], output_path: Path | None = None) -> None:
    """
    Trains an IsolationForest on a corpus of known-clean tracks and saves it.

    Call this offline when you have labelled clean activity data.

    Args:
        clean_tracks: List of GPS tracks (each track is a list of GpsPoints).
        output_path: Where to save the model. Defaults to MODEL_PATH.
    """
    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
    except ImportError:
        logger.error("ml_anomaly.train: scikit-learn and numpy required. pip install scikit-learn numpy")
        return

    feature_matrix = []
    for track in clean_tracks:
        feats = extract_features(track)
        if feats:
            feature_matrix.append(feats)

    if len(feature_matrix) < 10:
        logger.error("ml_anomaly.train: need ≥10 clean tracks, got %d", len(feature_matrix))
        return

    X = np.array(feature_matrix)
    clf = IsolationForest(
        n_estimators=200,
        contamination=0.05,   # 5% expected anomaly rate
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X)

    scores = clf.score_samples(X)
    mean_score = float(np.mean(scores))
    std_score = float(np.std(scores))
    dynamic_threshold = mean_score + (-3.0 * std_score)

    model_payload = {
        "model": clf,
        "mean_score": mean_score,
        "std_score": std_score,
        "dynamic_threshold": dynamic_threshold
    }

    save_path = output_path or MODEL_PATH
    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump(model_payload, f)

    logger.info("ml_anomaly.train: model saved to %s (trained on %d tracks)", save_path, len(feature_matrix))


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def ml_anomaly_score(points: list["GpsPoint"]) -> tuple[float | None, float | None]:
    """
    Returns an anomaly score and the dynamic threshold for a GPS track using the IsolationForest model.

    Returns:
        Tuple (score, threshold). None if model is unavailable or track is too short.
    """
    payload = _load_model()
    if payload is None:
        return None, None

    feats = extract_features(points)
    if feats is None:
        return None, None

    try:
        import numpy as np
        model = payload["model"]
        threshold = payload.get("dynamic_threshold", ANOMALY_THRESHOLD)
        score = float(model.score_samples(np.array([feats]))[0])
        return score, threshold
    except Exception as exc:
        logger.error("ml_anomaly.score: err=%s", exc)
        return None, None


def is_ml_anomaly(points: list["GpsPoint"]) -> bool:
    """
    Returns True if the track is statistically anomalous.

    Intended to be called after the Fast Selection Gate as Layer 1.5.
    Returns False (safe) if the model is unavailable — fails open,
    not closed, to prevent false positives.

    Args:
        points: List of GPS points from the track.

    Returns:
        True if anomalous, False if clean or model unavailable.
    """
    score, threshold = ml_anomaly_score(points)
    if score is None or threshold is None:
        return False   # Fail open: no model = no rejection

    is_anom = score < threshold
    if is_anom:
        logger.info("ml_anomaly.flagged score=%.4f threshold=%.4f", score, threshold)
    return is_anom
