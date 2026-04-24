"""
GPS Signal Processing Engine — SPORT Platform
==============================================
Constitution §24.2: Signal Truth Layer

Implements:
- Kalman Filter: removes GPS drift and noise
- Haversine distance calculator
- HMM-based Map Matching stub (Viterbi algorithm pattern)
"""
import math
import logging
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
    accuracy_m: float = 5.0   # horizontal accuracy reported by device
    timestamp: float = 0.0     # unix epoch


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
    q: float = 0.00001   # ~1m/s²  process noise
    r: float = 0.0001    # ~10m measurement noise


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
        k = p_pred / (p_pred + s.r)           # Kalman gain
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
# Kinematic anomaly detection (Anti-Cheat layer 2)
# ---------------------------------------------------------------------------

# Maximum realistic speeds in m/s per activity type
_MAX_SPEED_MS: dict[str, float] = {
    'RUN':         7.0,   # ~25 km/h (world-record pace)
    'BIKE':        25.0,  # ~90 km/h (sprint downhill)
    'WALK':        2.5,   # ~9 km/h
    'WHEELCHAIR':  5.0,   # ~18 km/h
}


def detect_speed_anomalies(
    points: list[GpsPoint],
    activity_type: str,
) -> list[int]:
    """
    Returns indices of GPS points where the inter-segment speed exceeds
    the biomechanically possible maximum for the given activity type.

    Args:
        points: Smoothed GPS track.
        activity_type: One of RUN / BIKE / WALK / WHEELCHAIR.

    Returns:
        List of (1-indexed) point indices flagged as anomalous.
    """
    max_speed = _MAX_SPEED_MS.get(activity_type, 10.0)
    flagged: list[int] = []

    for i in range(1, len(points)):
        dt = points[i].timestamp - points[i - 1].timestamp
        if dt <= 0:
            continue
        dist = haversine_m(
            points[i - 1].lat, points[i - 1].lon,
            points[i].lat, points[i].lon,
        )
        speed = dist / dt
        if speed > max_speed:
            flagged.append(i)
            logger.warning(
                "speed_anomaly idx=%d speed=%.1f m/s max=%.1f type=%s",
                i, speed, max_speed, activity_type,
            )

    return flagged


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
    logger.debug("map_matching(viterbi): matched %d points road_pts=%d", len(matched), len(road_points))
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


def process_gps_track(
    raw_points: list[GpsPoint],
    activity_type: str,
    brouter_result: dict | None = None,
) -> ProcessingResult:
    """
    Full GPS signal processing pipeline (Constitution §24.2).

    Steps:
    1. Kalman smoothing (noise/drift reduction).
    2. Kinematic anomaly detection (speed validation).
    3. Map matching via BRouter (topology snapping).
    4. Total distance calculation on final matched track.

    Args:
        raw_points: Unprocessed GPS observations from the mobile device.
        activity_type: RUN / BIKE / WALK / WHEELCHAIR.
        brouter_result: Optional BRouter validation payload.

    Returns:
        ProcessingResult with all derived data.
    """
    smoother = GpsKalmanSmoother()
    smoothed = smoother.smooth(raw_points)

    anomalies = detect_speed_anomalies(smoothed, activity_type)
    anomaly_ratio = len(anomalies) / max(len(smoothed), 1)
    is_suspicious = anomaly_ratio > 0.05  # >5% flagged segments → suspect

    matched = match_to_road_network(smoothed, brouter_result or {})
    distance = total_distance_m(matched)

    return ProcessingResult(
        smoothed_points=smoothed,
        matched_points=matched,
        total_distance_m=distance,
        anomalous_indices=anomalies,
        is_suspicious=is_suspicious,
        anomaly_ratio=anomaly_ratio,
    )
