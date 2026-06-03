"""
GPS Signal Processing Engine — SPORT Platform
==============================================
Constitution §24.2: Signal Truth Layer

Pipeline (Milestone 2+):

  raw GPS
    │
    ▼
  [1] fast_rejection_gate()          ← THIS FILE — cheap math, NO DB, NO network
      ├── Teleport detection          (>500m jump between consecutive points)
      ├── Acceleration gate           (humans can't do >6 m/s² sustained)
      ├── Motor vehicle fingerprint   (low variance, unnaturally smooth speed)
      └── Straight-line ratio         (>92% straight = bus/tram/car)
    │ PASS
    ▼
  [2] Kalman filter (noise smoothing)
    │
    ▼
  [3] V-max kinematic check          (per-sport biomechanical ceiling)
    │ PASS
    ▼
  [4] BRouter topological validation  (expensive — only reached if clean)
    │
    ▼
  [5] Viterbi HMM map matching
"""

import math
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class GpsPoint:
    """A single raw GPS observation."""

    lat: float
    lon: float
    accuracy_m: float = 5.0  # horizontal accuracy reported by device
    timestamp: float = 0.0  # unix epoch


@dataclass
class KalmanState:
    """
    Minimal 1-D Kalman state used per coordinate axis.

    Attributes:
        x: Current state estimate.
        p: Estimate covariance (uncertainty).
        q: Process noise (how fast the real position can change).
        r: Measurement noise (GPS accuracy variance).
    """

    x: float = 0.0
    p: float = 1.0
    q: float = 0.00001  # ~1m/s²  process noise
    r: float = 0.0001  # ~10m measurement noise


# ---------------------------------------------------------------------------
# Kalman Filter
# ---------------------------------------------------------------------------


class KalmanFilter1D:
    """
    Scalar Kalman filter for one coordinate axis.

    Implementation follows the standard predict → update cycle.
    """

    def __init__(self, q: float = 0.00001, r: float = 0.0001) -> None:
        self._state = KalmanState(q=q, r=r)

    def process(self, measurement: float) -> float:
        """
        Feeds one measurement into the filter and returns the smoothed estimate.

        Args:
            measurement: Raw GPS coordinate value (lat or lon).

        Returns:
            Smoothed coordinate value.
        """
        s = self._state

        # --- Predict ---
        # State prediction: position unchanged (constant-velocity model collapsed to constant position)
        x_pred = s.x
        p_pred = s.p + s.q

        # --- Update ---
        k = p_pred / (p_pred + s.r)  # Kalman gain
        s.x = x_pred + k * (measurement - x_pred)
        s.p = (1.0 - k) * p_pred

        return s.x


class GpsKalmanSmoother:
    """
    Applies independent Kalman filters to latitude and longitude.

    Usage::

        smoother = GpsKalmanSmoother()
        smoothed = smoother.smooth(raw_points)
    """

    def __init__(self) -> None:
        self._lat_filter = KalmanFilter1D()
        self._lon_filter = KalmanFilter1D()

    def smooth(self, points: list[GpsPoint]) -> list[GpsPoint]:
        """
        Smooths a list of GPS points using Kalman filtering.

        Args:
            points: Ordered list of raw GPS observations.

        Returns:
            New list of smoothed GpsPoint instances (same length).
        """
        if not points:
            return []

        # Seed filters with first observation to avoid initial transient
        self._lat_filter = KalmanFilter1D()
        self._lon_filter = KalmanFilter1D()

        smoothed: list[GpsPoint] = []
        for pt in points:
            s_lat = self._lat_filter.process(pt.lat)
            s_lon = self._lon_filter.process(pt.lon)
            smoothed.append(
                GpsPoint(
                    lat=s_lat,
                    lon=s_lon,
                    accuracy_m=pt.accuracy_m,
                    timestamp=pt.timestamp,
                )
            )

        logger.debug("kalman_smoother: processed %d points", len(smoothed))
        return smoothed


# ---------------------------------------------------------------------------
# Haversine distance
# ---------------------------------------------------------------------------

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle distance between two WGS-84 points.

    Args:
        lat1, lon1: Origin coordinates in decimal degrees.
        lat2, lon2: Destination coordinates in decimal degrees.

    Returns:
        Distance in metres.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c


def total_distance_m(points: list[GpsPoint]) -> float:
    """
    Sums haversine segments along a track.

    Args:
        points: Ordered GPS points.

    Returns:
        Total track length in metres.
    """
    if len(points) < 2:
        return 0.0
    return sum(
        haversine_m(points[i].lat, points[i].lon, points[i + 1].lat, points[i + 1].lon)
        for i in range(len(points) - 1)
    )


# ---------------------------------------------------------------------------
# V-max Kinematic Heuristics (Anti-Cheat layer 2 — Milestone 2)
# ---------------------------------------------------------------------------
#
# Biomechanical speed ceilings per sport (m/s).
# Values are conservative upper bounds; margin of +10% is applied internally
# to account for GPS jitter and legitimate speed bursts.
#
# Sources:
#   RUN:        World record marathon pace ~5.7 m/s; sprint max ~12.4 m/s
#   BIKE:       Road race sprint ~25 m/s; downhill limit 28 m/s
#   WALK:       Competitive walking world record ~4.2 m/s
#   WHEELCHAIR: World record 100m = ~8 m/s sprint; marathon ~7 m/s
# ---------------------------------------------------------------------------

VMAX_MS: dict[str, float] = {
    "RUN": 12.0,  # m/s — ~43 km/h, sprint burst
    "BIKE": 25.0,  # m/s — ~90 km/h
    "WALK": 3.5,  # m/s — ~12.6 km/h
    "WHEELCHAIR": 8.0,  # m/s — ~29 km/h
}

# Configurable via env (allow ops to tune without deploy)
_ANOMALY_RATIO_THRESHOLD = float(os.getenv("VMAX_ANOMALY_RATIO", "0.20"))  # >20% = suspicious
_CONSECUTIVE_THRESHOLD = int(os.getenv("VMAX_CONSECUTIVE", "3"))  # 3+ consecutive = reject
_VMAX_MARGIN = float(os.getenv("VMAX_MARGIN", "1.10"))  # 10% margin


# ---------------------------------------------------------------------------
# FAST SELECTION LAYER (Anti-Cheat Layer 1) — Pure math, O(N), no I/O
# ---------------------------------------------------------------------------
# This gate runs BEFORE Kalman, BEFORE BRouter, BEFORE any database access.
# It is the single most important cost-saving component in the whole pipeline.
# Inspired by: "Most fake activities are trivially identifiable by kinematics"
#
# Four independent tests. Any single FAIL → immediate reject.
# ---------------------------------------------------------------------------

# --- Thresholds (all configurable via .env) ---
_TELEPORT_JUMP_M = float(os.getenv("GATE_TELEPORT_M", "500"))  # >500m between consecutive pts
_MAX_ACCEL_MS2 = float(os.getenv("GATE_MAX_ACCEL", "6.0"))  # m/s² — sprint start ≈ 4-5 m/s²
_MOTOR_VARIANCE_RATIO = float(
    os.getenv("GATE_MOTOR_VAR", "0.05")
)  # speed σ/μ < 5% → suspiciously smooth
_STRAIGHT_LINE_RATIO = float(
    os.getenv("GATE_STRAIGHT_RATIO", "0.92")
)  # >92% displacement/track = bus/tram
_MOTOR_MIN_SEGMENTS = int(
    os.getenv("GATE_MOTOR_MIN_SEG", "15")
)  # need at least N segs for variance check


def fast_rejection_gate(
    points: list["GpsPoint"],
    activity_type: str,
) -> dict:
    """
    Fast Selection Layer — O(N) kinematic pre-filter.

    Applies four independent mathematical tests to detect non-human movement
    (cars, trams, buses, motorbikes) before any expensive processing.

    Tests:
        1. TELEPORT: Consecutive GPS jump > 500m in one interval.
           (Impossible for any human sport; indicates GPS spoof or vehicle)

        2. ACCELERATION: Sustained acceleration > 6 m/s².
           (Sprint start ≈ 4-5 m/s²; a tram accelerating is smoother but faster)

        3. MOTOR VEHICLE FINGERPRINT: Speed coefficient of variation (σ/μ) < 5%.
           (Humans naturally vary pace; a bus/tram maintains unnaturally constant speed)

        4. STRAIGHT-LINE RATIO: Displacement / total track length > 92%.
           (Running/cycling follows curves; straight-line ratio > 92% = road vehicle)

    Args:
        points: Raw GPS points (pre-Kalman — cheaper to run early).
        activity_type: 'RUN', 'BIKE', 'WALK', 'WHEELCHAIR'

    Returns:
        dict with:
            passed: bool
            reason: str | None  (None if passed)
            details: dict       (per-test numeric values for logging/audit)
    """
    if len(points) < 3:
        return {"passed": True, "reason": None, "details": {}}

    speeds: list[float] = []
    accels: list[float] = []
    prev_speed: float | None = None
    total_track_m = 0.0

    for i in range(1, len(points)):
        dt = points[i].timestamp - points[i - 1].timestamp
        if dt <= 0:
            prev_speed = None  # Reset to avoid stale acceleration calc
            continue

        dist = haversine_m(
            points[i - 1].lat,
            points[i - 1].lon,
            points[i].lat,
            points[i].lon,
        )
        total_track_m += dist
        speed = dist / dt
        speeds.append(speed)

        # --- Test 1: TELEPORT ---
        if dist > _TELEPORT_JUMP_M:
            logger.warning(
                "gate.TELEPORT idx=%d dist=%.1fm type=%s",
                i,
                dist,
                activity_type,
            )
            return {
                "passed": False,
                "reason": f"TELEPORT: {dist:.0f}m jump between points #{i - 1} and #{i}",
                "details": {"teleport_dist_m": dist, "idx": i},
            }

        # --- Test 2: ACCELERATION ---
        if prev_speed is not None and dt > 0:
            accel = abs(speed - prev_speed) / dt
            accels.append(accel)
            if accel > _MAX_ACCEL_MS2:
                logger.warning(
                    "gate.ACCEL idx=%d accel=%.2f m/s² limit=%.1f type=%s",
                    i,
                    accel,
                    _MAX_ACCEL_MS2,
                    activity_type,
                )
                return {
                    "passed": False,
                    "reason": f"ACCEL: {accel:.2f} m/s² exceeds physiological limit ({_MAX_ACCEL_MS2} m/s²)",
                    "details": {"accel_ms2": accel, "idx": i},
                }
        prev_speed = speed

    # --- Test 3: MOTOR VEHICLE FINGERPRINT (speed variance) ---
    if len(speeds) >= _MOTOR_MIN_SEGMENTS:
        mean_speed = sum(speeds) / len(speeds)
        if mean_speed > 0.5:  # only check if moving (>0.5 m/s = 1.8 km/h)
            variance = sum((s - mean_speed) ** 2 for s in speeds) / len(speeds)
            std_dev = math.sqrt(variance)
            cv = std_dev / mean_speed  # coefficient of variation

            # Humans are sloppy — their CV is typically 0.15–0.40
            # Motor vehicles: CV < 0.05 (cruise control, tracks, rails)
            if cv < _MOTOR_VARIANCE_RATIO:
                logger.warning(
                    "gate.MOTOR_FINGERPRINT cv=%.4f mean=%.2f m/s type=%s",
                    cv,
                    mean_speed,
                    activity_type,
                )
                return {
                    "passed": False,
                    "reason": f"MOTOR_FINGERPRINT: speed CV={cv:.3f} < {_MOTOR_VARIANCE_RATIO} (unnaturally constant)",
                    "details": {"speed_cv": cv, "mean_speed_ms": mean_speed, "std_dev": std_dev},
                }

    # --- Test 4: STRAIGHT-LINE RATIO ---
    if total_track_m > 200:  # only meaningful for tracks longer than 200m
        displacement_m = haversine_m(
            points[0].lat,
            points[0].lon,
            points[-1].lat,
            points[-1].lon,
        )
        straight_ratio = displacement_m / total_track_m

        if straight_ratio > _STRAIGHT_LINE_RATIO:
            logger.warning(
                "gate.STRAIGHT_LINE ratio=%.3f displacement=%.0fm track=%.0fm type=%s",
                straight_ratio,
                displacement_m,
                total_track_m,
                activity_type,
            )
            return {
                "passed": False,
                "reason": f"STRAIGHT_LINE: {straight_ratio:.1%} displacement ratio > {_STRAIGHT_LINE_RATIO:.0%} (vehicle pattern)",
                "details": {
                    "straight_ratio": straight_ratio,
                    "displacement_m": displacement_m,
                    "track_m": total_track_m,
                },
            }

    logger.debug(
        "gate.PASSED type=%s points=%d track_m=%.0f",
        activity_type,
        len(points),
        total_track_m,
    )
    return {"passed": True, "reason": None, "details": {"track_m": total_track_m}}


def detect_speed_anomalies(
    points: list[GpsPoint],
    activity_type: str,
) -> list[int]:
    """
    Advanced V-max kinematic anomaly detection.

    Algorithm:
    1. Per-segment speed check vs V-max * margin.
    2. Sliding window: flags consecutive anomalous sequences.
    3. Returns indices of flagged points.

    Args:
        points: Smoothed GPS track.
        activity_type: RUN / BIKE / WALK / WHEELCHAIR.

    Returns:
        List of (1-indexed) flagged segment indices.
    """
    max_speed = VMAX_MS.get(activity_type.upper(), 12.0) * _VMAX_MARGIN
    flagged: list[int] = []

    for i in range(1, len(points)):
        dt = points[i].timestamp - points[i - 1].timestamp
        if dt <= 0:
            continue
        dist = haversine_m(
            points[i - 1].lat,
            points[i - 1].lon,
            points[i].lat,
            points[i].lon,
        )
        speed_ms = dist / dt
        if speed_ms > max_speed:
            flagged.append(i)
            logger.warning(
                "vmax_violation idx=%d speed=%.2f m/s (%.1f km/h) limit=%.2f type=%s",
                i,
                speed_ms,
                speed_ms * 3.6,
                max_speed,
                activity_type,
            )

    return flagged


def analyze_anomalies(
    points: list[GpsPoint],
    activity_type: str,
) -> dict:
    """
    Full V-max heuristic analysis — returns verdict + detailed stats.

    Checks:
    - Anomaly ratio (>20% of segments above V-max → suspicious)
    - Consecutive run (3+ consecutive violations → suspicious)

    Args:
        points: Smoothed GPS track.
        activity_type: Sport type string.

    Returns:
        Dict with keys:
            flagged_indices: list[int]
            anomaly_ratio: float
            max_consecutive: int
            is_suspicious: bool
            reason: str | None
    """
    flagged = detect_speed_anomalies(points, activity_type)
    n = max(len(points) - 1, 1)
    ratio = len(flagged) / n

    # Find longest consecutive run of anomalous indices
    max_consecutive = 0
    if flagged:
        run = 1
        for j in range(1, len(flagged)):
            if flagged[j] == flagged[j - 1] + 1:
                run += 1
                max_consecutive = max(max_consecutive, run)
            else:
                run = 1
        max_consecutive = max(max_consecutive, run)

    is_suspicious = False
    reason: str | None = None

    if ratio > _ANOMALY_RATIO_THRESHOLD:
        is_suspicious = True
        reason = f"anomaly_ratio={ratio:.2%} exceeds {_ANOMALY_RATIO_THRESHOLD:.0%} threshold"
    elif max_consecutive >= _CONSECUTIVE_THRESHOLD:
        is_suspicious = True
        reason = (
            f"{max_consecutive} consecutive V-max violations (threshold={_CONSECUTIVE_THRESHOLD})"
        )

    if is_suspicious:
        logger.warning(
            "activity_suspicious type=%s ratio=%.2f consecutive=%d reason=%s",
            activity_type,
            ratio,
            max_consecutive,
            reason,
        )
    else:
        logger.debug(
            "activity_clean type=%s ratio=%.2f consecutive=%d",
            activity_type,
            ratio,
            max_consecutive,
        )

    return {
        "flagged_indices": flagged,
        "anomaly_ratio": round(ratio, 4),
        "max_consecutive": max_consecutive,
        "is_suspicious": is_suspicious,
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# Map Matching stub (HMM / Viterbi pattern — BRouter delegated)
# ---------------------------------------------------------------------------


def match_to_road_network(
    points: list[GpsPoint],
    brouter_result: dict,
) -> list[GpsPoint]:
    """
    Applies HMM Viterbi map-matching to snap Kalman-smoothed GPS points
    to the road network returned by BRouter (Constitution §24.2).

    Uses the full Viterbi algorithm (Newson & Krumm, 2009) for maximum
    accuracy. Falls back to raw smoothed points if BRouter data is unavailable.

    Args:
        points: Kalman-smoothed GPS observations.
        brouter_result: Parsed GeoJSON from BRouterService.validate_track().

    Returns:
        List of map-matched GpsPoint instances (same length as input).
    """
    if not brouter_result.get("success") or not brouter_result.get("raw_data"):
        logger.debug("map_matching: brouter result unavailable, returning smoothed points")
        return points

    try:
        coords = brouter_result["raw_data"]["features"][0]["geometry"]["coordinates"]
        road_points = [GpsPoint(lat=c[1], lon=c[0]) for c in coords]
    except (KeyError, IndexError, TypeError):
        return points

    # Delegate to Viterbi HMM (lazy import to avoid circular deps)
    from .viterbi_matching import viterbi_match

    matched = viterbi_match(points, road_points)
    logger.debug(
        "map_matching(viterbi): matched %d points road_pts=%d", len(matched), len(road_points)
    )
    return matched


# ---------------------------------------------------------------------------
# Public pipeline facade
# ---------------------------------------------------------------------------


@dataclass
class ProcessingResult:
    """Aggregated output of the full signal processing pipeline."""

    smoothed_points: list[GpsPoint] = field(default_factory=list)
    matched_points: list[GpsPoint] = field(default_factory=list)
    total_distance_m: float = 0.0
    anomalous_indices: list[int] = field(default_factory=list)
    is_suspicious: bool = False
    anomaly_ratio: float = 0.0
    max_consecutive: int = 0
    suspicious_reason: str | None = None


def process_gps_track(
    raw_points: list[GpsPoint],
    activity_type: str,
    brouter_result: dict | None = None,
) -> ProcessingResult:
    """
    Full GPS signal processing pipeline (Constitution §24.2).

    Steps:
    1. Kalman smoothing (noise/drift reduction).
    2. V-max kinematic heuristic analysis (anti-cheat).
    3. Map matching via Viterbi HMM + BRouter (topology snapping).
    4. Total distance calculation on final matched track.

    Args:
        raw_points: Unprocessed GPS observations from mobile device.
        activity_type: RUN / BIKE / WALK / WHEELCHAIR.
        brouter_result: Optional BRouter validation payload.

    Returns:
        ProcessingResult with all derived data and anti-cheat verdict.
    """
    if not raw_points:
        return ProcessingResult()

    smoother = GpsKalmanSmoother()
    smoothed = smoother.smooth(raw_points)

    analysis = analyze_anomalies(smoothed, activity_type)

    matched = match_to_road_network(smoothed, brouter_result or {})
    distance = total_distance_m(matched)

    return ProcessingResult(
        smoothed_points=smoothed,
        matched_points=matched,
        total_distance_m=distance,
        anomalous_indices=analysis["flagged_indices"],
        is_suspicious=analysis["is_suspicious"],
        anomaly_ratio=analysis["anomaly_ratio"],
        max_consecutive=analysis["max_consecutive"],
        suspicious_reason=analysis["reason"],
    )
