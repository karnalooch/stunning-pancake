from django.test import SimpleTestCase

from core.sport_scope import (
    activity_matches_sport_filter,
    is_allowed_activity_type,
    normalize_activity_type,
)


class SportScopeTests(SimpleTestCase):
    def test_normalize_aliases(self):
        self.assertEqual(normalize_activity_type("ride"), "BIKE")
        self.assertEqual(normalize_activity_type("run"), "RUN")
        self.assertEqual(normalize_activity_type("nw"), "WALK")
        self.assertEqual(normalize_activity_type("BIKE"), "BIKE")

    def test_allowed_types(self):
        self.assertTrue(is_allowed_activity_type("RUN"))
        self.assertFalse(is_allowed_activity_type("WHEELCHAIR"))

    def test_sport_filter_walk_only(self):
        self.assertTrue(activity_matches_sport_filter("WALK", "WALK"))
        self.assertFalse(activity_matches_sport_filter("BIKE", "WALK"))

    def test_sport_filter_all_three(self):
        self.assertTrue(activity_matches_sport_filter("RUN", "RUN_BIKE_WALK"))
        self.assertTrue(activity_matches_sport_filter("WALK", "ALL"))
