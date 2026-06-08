import time

from django.test import TestCase

from users.mfa import _totp_at, generate_totp_secret, verify_totp


class MfaTotpTests(TestCase):
    def test_generate_secret(self):
        s = generate_totp_secret()
        self.assertGreater(len(s), 16)

    def test_verify_roundtrip(self):
        secret = generate_totp_secret()
        counter = int(time.time()) // 30
        code = _totp_at(secret, counter)
        self.assertTrue(verify_totp(secret, code))
