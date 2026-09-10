import unittest

from check_config_secrets import violations


class ConfigSecretsTests(unittest.TestCase):
    def test_rejects_signing_keys_even_if_placeholder_or_empty(self):
        for value in ('"test-only-value"', '"CHANGE_ME"', '""', 'null'):
            with self.subTest(value=value):
                self.assertEqual(violations('{"variables":{"SECRET_KEY":' + value + '}}'), ["SECRET_KEY"])

    def test_allows_configuration_without_signing_keys(self):
        self.assertEqual(violations('{"variables":{"DEBUG":"0"}}'), [])

    def test_rejects_separate_jwt_key(self):
        self.assertEqual(violations('{"variables":{"JWT_SIGNING_KEY":"test"}}'), ["JWT_SIGNING_KEY"])

    def test_invalid_json_fails(self):
        with self.assertRaises(ValueError):
            violations('{')
