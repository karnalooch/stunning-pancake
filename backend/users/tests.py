from django.test import TestCase
from .models import User

class UserTest(TestCase):
    """
    Test suite for User model and registration.
    """
    def setUp(self):
        self.user = User.objects.create_user(
            username="testathlete",
            email="test@sport.com",
            password="testpassword123",
            role="ATHLETE",
            tenant_id="CITY_LDN"
        )

    def test_user_creation(self):
        self.assertEqual(self.user.username, "testathlete")
        self.assertEqual(self.user.role, "ATHLETE")
        self.assertEqual(self.user.tenant_id, "CITY_LDN")
        self.assertTrue(self.user.check_password("testpassword123"))

    def test_user_str(self):
        self.assertEqual(str(self.user), "testathlete (End User / Athlete)")
