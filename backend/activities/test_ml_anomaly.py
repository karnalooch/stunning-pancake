"""
P3 Tests — ML Anomaly Detection
=================================
Tests feature extraction and inference for the Isolation Forest
anomaly detector (Layer 1.5 anti-cheat).
"""
import pytest
from unittest.mock import patch, MagicMock
from activities.ml_anomaly import extract_features, is_ml_anomaly, ml_anomaly_score
from activities.signal_processing import GpsPoint


class TestMLAnomaly:
    def test_extract_features_returns_none_for_short_track(self):
        """Tracks with < 20 points should return None."""
        points = [GpsPoint(lat=52.0, lon=21.0, timestamp=float(i)) for i in range(10)]
        assert extract_features(points) is None

    def test_extract_features_returns_8_features(self):
        """Valid track should return 8-dimensional feature vector."""
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0, timestamp=float(i))
            for i in range(30)
        ]
        features = extract_features(points)
        assert features is not None
        assert len(features) == 8

    def test_extract_features_all_finite(self):
        """All features should be finite numbers."""
        import math
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0 + i * 0.00005, timestamp=float(i))
            for i in range(25)
        ]
        features = extract_features(points)
        assert features is not None
        for f in features:
            assert math.isfinite(f), f"Feature {f} is not finite"

    def test_is_ml_anomaly_fails_open_without_model(self):
        """Should return False (safe) when model is unavailable."""
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0, timestamp=float(i))
            for i in range(30)
        ]
        with patch('activities.ml_anomaly._load_model', return_value=None):
            assert is_ml_anomaly(points) is False

    def test_ml_anomaly_score_returns_none_without_model(self):
        """Should return (None, None) when model is unavailable."""
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0, timestamp=float(i))
            for i in range(30)
        ]
        with patch('activities.ml_anomaly._load_model', return_value=None):
            score, threshold = ml_anomaly_score(points)
            assert score is None
            assert threshold is None

    def test_ml_anomaly_score_returns_none_for_short_track(self):
        """Should return (None, None) for tracks with too few points."""
        points = [GpsPoint(lat=52.0, lon=21.0, timestamp=float(i)) for i in range(5)]
        # Even with a loaded model, short tracks should return None
        mock_payload = {"model": MagicMock(), "dynamic_threshold": -0.15}
        with patch('activities.ml_anomaly._load_model', return_value=mock_payload):
            score, threshold = ml_anomaly_score(points)
            assert score is None
            assert threshold is None

    def test_is_ml_anomaly_with_sensitivity_gt_1_is_more_forgiving(self):
        """Higher sensitivity multiplier should make detection more forgiving."""
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0, timestamp=float(i))
            for i in range(30)
        ]
        # sensitivity > 1 makes effective_threshold lower (more negative)
        # = harder to flag as anomaly
        with patch('activities.ml_anomaly._load_model') as mock_load:
            mock_load.return_value = {"model": MagicMock(), "dynamic_threshold": -0.10}
            # With sensitivity=2.0, effective_threshold = -0.10 * (2.0-2.0) = 0
            # So no score should be below 0 (since scores are in [-1, 0])
            # is_ml_anomaly should return False
            result = is_ml_anomaly(points, sensitivity=2.0)
            assert result is False

    def test_extract_features_constant_speed_track(self):
        """Track with constant speed should have near-zero std_dev and CV."""
        import math
        # Points equally spaced in lat at 1-second intervals (~11.1 m/s each segment)
        points = [
            GpsPoint(lat=52.0 + i * 0.0001, lon=21.0, timestamp=float(i))
            for i in range(25)
        ]
        features = extract_features(points)
        assert features is not None
        mean_spd, std_spd, cv = features[0], features[1], features[2]
        # All segments are ~11.1 m/s, so std should be near 0
        assert std_spd < 1.0
        # CV should be very low for constant-speed track
        assert cv < 0.1
