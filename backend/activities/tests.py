from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.utils import timezone
from .models import Activity, PrivacyZone

User = get_user_model()

class ActivityTest(TestCase):
    """
    Test suite for Activity recording and processing.
    """
    def setUp(self):
        self.user = User.objects.create_user(
            username="runner",
            password="password"
        )
        self.activity = Activity.objects.create(
            user=self.user,
            type="RUN",
            start_time=timezone.now(),
            distance=5000.0
        )

    def test_activity_creation(self):
        self.assertEqual(self.activity.user.username, "runner")
        self.assertEqual(self.activity.distance, 5000.0)
        self.assertFalse(self.activity.is_verified)

    def test_privacy_zone(self):
        zone = PrivacyZone.objects.create(
            user=self.user,
            center=Point(0.0, 0.0),
            radius=100.0
        )
        self.assertEqual(zone.radius, 100.0)

