"""
Unit Tests — GPS Signal Processing
=====================================
Tests for Kalman filter, Viterbi map-matching, and kinematic anomaly detection.
"""
import pytest

from activities.signal_processing import (
    GpsKalmanSmoother,
    GpsPoint,
    ProcessingResult,
    detect_speed_anomalies,
    haversine_m,
    process_gps_track,
    total_distance_m,
)
from activities.viterbi_matching import (
    emission_probability,
    transition_probability,
    viterbi_match,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def straight_track() -> list[GpsPoint]:
    """10 GPS points along a straight line (Siedlce, ~10m apart)."""
    base_lat, base_lon = 52.1686, 22.2875
    return [
        GpsPoint(lat=base_lat + i * 0.0001, lon=base_lon, timestamp=float(i))
        for i in range(10)
    ]


@pytest.fixture
def noisy_track() -> list[GpsPoint]:
    """10 GPS points with artificial noise added."""
    import random
    random.seed(42)
    base_lat, base_lon = 52.1686, 22.2875
    return [
        GpsPoint(
            lat=base_lat + i * 0.0001 + random.gauss(0, 0.00002),
            lon=base_lon + random.gauss(0, 0.00002),
            timestamp=float(i),
        )
        for i in range(10)
    ]


@pytest.fixture
def road_points() -> list[GpsPoint]:
    """Synthetic road segment (straight line)."""
    base_lat, base_lon = 52.1686, 22.2875
    return [
        GpsPoint(lat=base_lat + i * 0.0001, lon=base_lon)
        for i in range(20)
    ]


# ---------------------------------------------------------------------------
# Haversine tests
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_m(52.0, 21.0, 52.0, 21.0) == pytest.approx(0.0, abs=0.01)

    def test_known_distance(self):
        # Warsaw to Krakow ~252 km
        d = haversine_m(52.2297, 21.0122, 50.0647, 19.9450)
        assert 250_000 < d < 260_000

    def test_symmetry(self):
        d1 = haversine_m(52.0, 21.0, 52.1, 21.1)
        d2 = haversine_m(52.1, 21.1, 52.0, 21.0)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_short_distance(self):
        d = haversine_m(52.0, 21.0, 52.0001, 21.0)
        assert 10 < d < 15


class TestTotalDistance:
    def test_empty_returns_zero(self):
        assert total_distance_m([]) == 0.0

    def test_single_point_returns_zero(self):
        assert total_distance_m([GpsPoint(lat=52.0, lon=21.0)]) == 0.0

    def test_accumulates_segments(self, straight_track):
        d = total_distance_m(straight_track)
        assert 80 < d < 120


# ---------------------------------------------------------------------------
# Kalman filter tests
# ---------------------------------------------------------------------------

class TestGpsKalmanSmoother:
    def test_empty_input(self):
        smoother = GpsKalmanSmoother()
        assert smoother.smooth([]) == []

    def test_output_same_length(self, noisy_track):
        smoother = GpsKalmanSmoother()
        result = smoother.smooth(noisy_track)
        assert len(result) == len(noisy_track)

    def test_timestamps_preserved(self, noisy_track):
        smoother = GpsKalmanSmoother()
        result = smoother.smooth(noisy_track)
        for orig, smoothed in zip(noisy_track, result, strict=False):
            assert smoothed.timestamp == orig.timestamp

    def test_smoothing_reduces_variance(self, noisy_track):
        smoother = GpsKalmanSmoother()
        result = smoother.smooth(noisy_track)
        raw_var = sum((p.lat - noisy_track[5].lat) ** 2 for p in noisy_track)
        smooth_var = sum((p.lat - result[5].lat) ** 2 for p in result)
        assert smooth_var <= raw_var

    def test_first_point_close_to_input(self, straight_track):
        smoother = GpsKalmanSmoother()
        result = smoother.smooth(straight_track)
        assert abs(result[0].lat - straight_track[0].lat) < 0.001


# ---------------------------------------------------------------------------
# Anomaly detection tests
# ---------------------------------------------------------------------------

class TestSpeedAnomalyDetection:
    def test_detects_teleport(self):
        pts = [
            GpsPoint(lat=52.0, lon=21.0, timestamp=0.0),
            GpsPoint(lat=52.01, lon=21.0, timestamp=1.0),   # ~1110 m/s
        ]
        flagged = detect_speed_anomalies(pts, 'RUN')
        assert 1 in flagged

    def test_skips_zero_dt(self):
        pts = [
            GpsPoint(lat=52.0, lon=21.0, timestamp=0.0),
            GpsPoint(lat=52.001, lon=21.0, timestamp=0.0),
        ]
        flagged = detect_speed_anomalies(pts, 'RUN')
        assert isinstance(flagged, list)

    def test_no_anomaly_on_normal_walk(self):
        # 3 m/s for 10s = 30m — fine for walking
        pts = [
            GpsPoint(lat=52.0, lon=21.0, timestamp=0.0),
            GpsPoint(lat=52.00027, lon=21.0, timestamp=10.0),  # ~30m in 10s
        ]
        flagged = detect_speed_anomalies(pts, 'WALK')
        assert flagged == []


# ---------------------------------------------------------------------------
# Viterbi map-matching tests
# ---------------------------------------------------------------------------

class TestViterbiMatching:
    def test_returns_same_length(self, straight_track, road_points):
        result = viterbi_match(straight_track, road_points)
        assert len(result) == len(straight_track)

    def test_empty_observations(self, road_points):
        result = viterbi_match([], road_points)
        assert result == []

    def test_empty_road(self, straight_track):
        result = viterbi_match(straight_track, [])
        assert result == straight_track

    def test_timestamps_preserved(self, straight_track, road_points):
        result = viterbi_match(straight_track, road_points)
        for orig, matched in zip(straight_track, result, strict=False):
            assert matched.timestamp == orig.timestamp

    def test_matched_points_near_road(self, straight_track, road_points):
        result = viterbi_match(straight_track, road_points)
        for pt in result:
            min_dist = min(haversine_m(pt.lat, pt.lon, r.lat, r.lon) for r in road_points)
            assert min_dist <= 50.0

    def test_emission_probability_decreasing(self):
        assert emission_probability(5.0) > emission_probability(50.0)

    def test_transition_probability_decreasing(self):
        assert transition_probability(1.0) > transition_probability(100.0)


# ---------------------------------------------------------------------------
# Full pipeline integration test
# ---------------------------------------------------------------------------

class TestProcessGpsTrack:
    def test_returns_processing_result(self, straight_track):
        result = process_gps_track(straight_track, 'RUN')
        assert isinstance(result, ProcessingResult)

    def test_matched_same_length_as_input(self, straight_track):
        result = process_gps_track(straight_track, 'RUN')
        assert len(result.matched_points) == len(straight_track)

    def test_distance_positive(self, straight_track):
        result = process_gps_track(straight_track, 'RUN')
        assert result.total_distance_m > 0

    def test_clean_track_not_suspicious(self, straight_track):
        result = process_gps_track(straight_track, 'RUN')
        assert result.anomaly_ratio == pytest.approx(0.0, abs=0.01)

    def test_empty_track(self):
        result = process_gps_track([], 'RUN')
        assert result.total_distance_m == 0.0
        assert result.matched_points == []
