import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import backup_crypto
from backup_crypto import BackupCryptoError, decrypt_file_to_stream, encrypt_stream, generate_key


class BackupCryptoTests(unittest.TestCase):
    def test_round_trip_uses_authenticated_encrypted_artifact(self):
        payload = (b"4velo-private-backup\x00" * 4096) + b"tail"
        key = generate_key()

        with tempfile.TemporaryDirectory() as folder:
            artifact = Path(folder) / "backup.dump.enc"
            encrypt_stream(io.BytesIO(payload), artifact, key)

            self.assertTrue(artifact.is_file())
            self.assertNotIn(payload[:32], artifact.read_bytes())

            restored = io.BytesIO()
            decrypt_file_to_stream(artifact, restored, key)
            self.assertEqual(restored.getvalue(), payload)

    def test_tampered_artifact_releases_no_plaintext(self):
        payload = b"sensitive database bytes" * 100
        key = generate_key()

        with tempfile.TemporaryDirectory() as folder:
            artifact = Path(folder) / "backup.dump.enc"
            encrypt_stream(io.BytesIO(payload), artifact, key)
            raw = bytearray(artifact.read_bytes())
            raw[len(raw) // 2] ^= 0x01
            artifact.write_bytes(raw)

            restored = io.BytesIO()
            with self.assertRaises(BackupCryptoError):
                decrypt_file_to_stream(artifact, restored, key)
            self.assertEqual(restored.getvalue(), b"")

    def test_source_replacement_after_verification_cannot_change_released_plaintext(self):
        payload = b"stable authenticated backup" * 100
        key = generate_key()

        with tempfile.TemporaryDirectory() as folder:
            artifact = Path(folder) / "backup.dump.enc"
            encrypt_stream(io.BytesIO(payload), artifact, key)
            restored = io.BytesIO()
            real_decrypt_pass = backup_crypto._decrypt_pass
            seen_sources = []

            def observing_pass(source, *args, **kwargs):
                seen_sources.append(source)
                result = real_decrypt_pass(source, *args, **kwargs)
                if len(seen_sources) == 1:
                    artifact.write_bytes(b"attacker replaced original source")
                return result

            with patch.object(backup_crypto, "_decrypt_pass", side_effect=observing_pass):
                decrypt_file_to_stream(artifact, restored, key)

            self.assertEqual(restored.getvalue(), payload)
            self.assertEqual(len(seen_sources), 2)
            self.assertEqual(seen_sources[0], seen_sources[1])
            self.assertNotEqual(seen_sources[0], artifact)
            self.assertFalse(seen_sources[0].exists())

    def test_wrong_key_releases_no_plaintext(self):
        payload = b"sensitive database bytes" * 100

        with tempfile.TemporaryDirectory() as folder:
            artifact = Path(folder) / "backup.dump.enc"
            encrypt_stream(io.BytesIO(payload), artifact, generate_key())

            restored = io.BytesIO()
            with self.assertRaises(BackupCryptoError):
                decrypt_file_to_stream(artifact, restored, generate_key())
            self.assertEqual(restored.getvalue(), b"")


if __name__ == "__main__":
    unittest.main()
