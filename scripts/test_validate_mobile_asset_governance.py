from __future__ import annotations

import base64
import copy
import hashlib
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from scripts.validate_mobile_asset_governance import load_policy, validate_policy

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "assets" / "ASSET_GOVERNANCE_V1.json"


class AssetGovernanceValidatorTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy(POLICY_PATH)

    def test_repository_policy_passes(self):
        self.assertEqual(validate_policy(self.policy, ROOT), [])


    def test_ride_marker_png_stream_is_recoverable_losslessly(self):
        path = ROOT / "mobile" / "assets" / "approved" / "v1" / "ride_marker_rider_v1.png"
        data = path.read_bytes()

        signature = b"\x89PNG\r\n\x1a\n"
        self.assertTrue(data.startswith(signature))
        ihdr_length = struct.unpack(">I", data[8:12])[0]
        self.assertEqual(ihdr_length, 13)
        self.assertEqual(data[12:16], b"IHDR")
        ihdr_payload = data[16:29]
        width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack(
            ">IIBBBBB", ihdr_payload
        )
        self.assertEqual((width, height), (64, 64))
        self.assertEqual((bit_depth, color_type, compression, filter_method, interlace), (8, 6, 0, 0, 0))

        declared_idat_length = struct.unpack(">I", data[33:37])[0]
        self.assertEqual(data[37:41], b"IDAT")
        payload_start = 41
        declared_payload_end = payload_start + declared_idat_length
        declared_payload = data[payload_start:declared_payload_end]
        stale_crc = data[declared_payload_end:declared_payload_end + 4]
        continuation = data[declared_payload_end + 4:]

        # The corrupt runtime derivative appears to contain a valid zlib prefix,
        # followed by four stale CRC bytes, then the continuation of the same
        # compressed stream. Prove that stitching only the compressed payload
        # recovers the full 64x64 RGBA scanline stream.
        prefix_decoder = zlib.decompressobj()
        prefix_decoded = prefix_decoder.decompress(declared_payload)
        self.assertFalse(prefix_decoder.eof, "declared IDAT unexpectedly already contains a complete stream")

        decoded = prefix_decoded + prefix_decoder.decompress(continuation) + prefix_decoder.flush()
        self.assertTrue(prefix_decoder.eof, "stitched IDAT continuation is still truncated/corrupt")
        self.assertEqual(prefix_decoder.unused_data, b"", "unexpected bytes after recovered zlib stream")

        expected_decoded = height * (1 + width * 4)
        self.assertEqual(len(decoded), expected_decoded)

        compressed = declared_payload + continuation

        def chunk(kind: bytes, payload: bytes) -> bytes:
            crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
            return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)

        repaired = signature + chunk(b"IHDR", ihdr_payload) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
        repaired_sha = hashlib.sha256(repaired).hexdigest()
        decoded_sha = hashlib.sha256(decoded).hexdigest()

        print(
            "ride_marker_rider_v1.png recovery:",
            {
                "originalBytes": len(data),
                "declaredIdatBytes": declared_idat_length,
                "staleCrcHex": stale_crc.hex(),
                "continuationBytes": len(continuation),
                "decodedBytes": len(decoded),
                "decodedSha256": decoded_sha,
                "repairedBytes": len(repaired),
                "repairedSha256": repaired_sha,
            },
        )
        print("REPAIRED_RIDE_MARKER_BASE64=" + base64.b64encode(repaired).decode("ascii"))

    def test_duplicate_target_id_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["productionTargets"].append(copy.deepcopy(policy["productionTargets"][0]))
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("duplicate production target id" in error for error in errors))

    def test_generated_official_crest_policy_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["placeIdentity"]["officialCrestMayBeAiGenerated"] = True
        errors = validate_policy(policy, ROOT)
        self.assertIn("official crests must never be AI-generated", errors)

    def test_missing_place_fallback_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["placeIdentity"]["fallbackRequired"] = False
        errors = validate_policy(policy, ROOT)
        self.assertIn("place identity fallback must be mandatory", errors)

    def test_approved_asset_requires_provenance_and_digest(self):
        policy = copy.deepcopy(self.policy)
        policy["productionTargets"][0]["status"] = "approved"
        policy["productionTargets"][0].pop("provenance", None)
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("approved asset requires provenance" in error for error in errors))

        policy["productionTargets"][0]["provenance"] = {
            "sourceType": "human_authored",
            "sourceReference": "asset-ticket-1",
            "rightsStatus": "owned",
            "sha256": "not-a-digest",
            "createdAt": "2026-09-25",
        }
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("sha256 must be 64 lowercase hex chars" in error for error in errors))

    def test_legacy_inventory_drift_fails(self):
        policy = copy.deepcopy(self.policy)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            generated = root / "assets" / "generated"
            generated.mkdir(parents=True)
            (generated / "one.png").write_bytes(b"x")
            policy["legacyGeneratedPolicy"]["expectedVisualFileCount"] = 0
            errors = validate_policy(policy, root)
        self.assertTrue(any("legacy visual inventory drift" in error for error in errors))

    def test_legacy_runtime_use_must_be_forbidden(self):
        policy = copy.deepcopy(self.policy)
        policy["legacyGeneratedPolicy"]["temporaryRuntimeUseAllowed"] = True
        errors = validate_policy(policy, ROOT)
        self.assertIn("legacy generated assets must not be allowed at runtime", errors)


if __name__ == "__main__":
    unittest.main()
