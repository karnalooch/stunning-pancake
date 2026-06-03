"""
Unit Tests — Events Engine
=====================================
Tests for EventProgressService, EventNormalizationService, and LeaderboardService.
"""

import pytest
from unittest.mock import MagicMock, patch
from events.services import EventProgressService, EventNormalizationService
from activities.leaderboards import LeaderboardService


# ---------------------------------------------------------------------------
# LeaderboardService tests (mocked Redis)
# ---------------------------------------------------------------------------


class TestLeaderboardService:
    def setup_method(self):
        LeaderboardService._redis = None  # reset singleton

    @patch("activities.leaderboards.redis.from_url")
    def test_update_score_calls_zincrby(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_redis_factory.return_value = mock_r

        LeaderboardService.update_score(user_id=42, entity_id="siedlce", score_delta=5.5)

        mock_r.zincrby.assert_called_once_with("leaderboard:city:siedlce", 5.5, "42")

    @patch("activities.leaderboards.redis.from_url")
    def test_update_score_event_scope(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_redis_factory.return_value = mock_r

        LeaderboardService.update_score(user_id=1, entity_id=99, score_delta=10.0, scope="event")

        mock_r.zincrby.assert_called_once_with("leaderboard:event:99", 10.0, "1")

    @patch("activities.leaderboards.redis.from_url")
    def test_get_top_users_returns_list(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_r.zrevrange.return_value = [(b"42", 100.0), (b"7", 80.5)]
        mock_redis_factory.return_value = mock_r

        result = LeaderboardService.get_top_users("siedlce", limit=2)

        assert len(result) == 2
        assert result[0]["user_id"] == "42"
        assert result[0]["score"] == 100.0

    @patch("activities.leaderboards.redis.from_url")
    def test_get_user_rank_returns_1indexed(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_r.zrevrank.return_value = 0  # 0-indexed = rank 1
        mock_redis_factory.return_value = mock_r

        rank = LeaderboardService.get_user_rank("siedlce", 42)

        assert rank == 1

    @patch("activities.leaderboards.redis.from_url")
    def test_get_user_rank_none_when_missing(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_r.zrevrank.return_value = None
        mock_redis_factory.return_value = mock_r

        rank = LeaderboardService.get_user_rank("siedlce", 999)
        assert rank is None

    @patch("activities.leaderboards.redis.from_url")
    def test_redis_error_returns_empty(self, mock_redis_factory):
        mock_r = MagicMock()
        mock_r.zrevrange.side_effect = Exception("connection refused")
        mock_redis_factory.return_value = mock_r

        result = LeaderboardService.get_top_users("siedlce")
        assert result == []


# ---------------------------------------------------------------------------
# EventNormalizationService tests
# ---------------------------------------------------------------------------


class TestEventNormalizationService:
    def test_returns_zero_when_no_participants(self):
        from unittest.mock import patch, MagicMock

        mock_event = MagicMock()
        mock_event.sport_filter = "RUN"

        with patch("events.services.Participation") as MockParticipation:
            MockParticipation.objects.filter.return_value.count.return_value = 0
            result = EventNormalizationService.get_tenant_score(mock_event, "tenant_a")

        assert result == 0.0

    def test_complexity_factor_applied_for_run(self):
        from unittest.mock import patch, MagicMock

        mock_event = MagicMock()
        mock_event.sport_filter = "RUN"

        mock_p1 = MagicMock(total_km=10.0)
        mock_p2 = MagicMock(total_km=10.0)

        with patch("events.services.Participation") as MockParticipation:
            mock_qs = MagicMock()
            mock_qs.count.return_value = 2
            mock_qs.__iter__ = MagicMock(return_value=iter([mock_p1, mock_p2]))
            MockParticipation.objects.filter.return_value = mock_qs

            result = EventNormalizationService.get_tenant_score(mock_event, "tenant_a")

        # (10 + 10) * 1.2 / 2 = 12.0
        assert result == pytest.approx(12.0)


# ---------------------------------------------------------------------------
# Plugin Registry tests
# ---------------------------------------------------------------------------


class TestPluginRegistry:
    def test_register_and_list(self):
        from core.plugin_registry import PluginRegistry, PluginManifest

        reg = PluginRegistry()
        manifest = PluginManifest(
            name="test_plugin",
            version="1.0.0",
            author="test",
            description="Test plugin",
            hooks=["activity.verified"],
        )
        reg.register(manifest)
        plugins = reg.list_plugins()
        assert any(p["name"] == "test_plugin" for p in plugins)

    def test_double_register_raises(self):
        from core.plugin_registry import PluginRegistry, PluginManifest

        reg = PluginRegistry()
        manifest = PluginManifest(
            name="dup_plugin",
            version="1.0.0",
            author="test",
            description="Duplicate test",
            hooks=[],
        )
        reg.register(manifest)
        with pytest.raises(ValueError, match="already registered"):
            reg.register(manifest)

    def test_fire_calls_handler(self):
        from core.plugin_registry import PluginRegistry, PluginManifest

        reg = PluginRegistry()
        called_with = {}

        @reg.hook("test.event")
        def handler(**kwargs):
            called_with.update(kwargs)
            return "ok"

        results = reg.fire("test.event", activity="fake_activity")
        assert results == ["ok"]
        assert called_with.get("activity") == "fake_activity"

    def test_fire_catches_exceptions(self):
        from core.plugin_registry import PluginRegistry

        reg = PluginRegistry()

        @reg.hook("error.event")
        def broken_handler(**kwargs):
            raise RuntimeError("boom")

        # Should not raise; returns None for failed handler
        results = reg.fire("error.event")
        assert results == [None]

    def test_fire_unknown_hook_returns_empty(self):
        from core.plugin_registry import PluginRegistry

        reg = PluginRegistry()
        results = reg.fire("no.such.hook")
        assert results == []

    def test_unregister_removes_plugin(self):
        from core.plugin_registry import PluginRegistry, PluginManifest

        reg = PluginRegistry()
        manifest = PluginManifest(
            name="removable",
            version="1.0.0",
            author="test",
            description="Will be removed",
            hooks=["x.event"],
        )
        reg.register(manifest)
        reg.unregister("removable")
        assert not any(p["name"] == "removable" for p in reg.list_plugins())
