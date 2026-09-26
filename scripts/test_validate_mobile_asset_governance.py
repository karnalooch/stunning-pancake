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


    def test_ride_marker_png_crc_repair_is_lossless(self):
        path = ROOT / "mobile" / "assets" / "approved" / "v1" / "ride_marker_rider_v1.png"
        data = path.read_bytes()
        print("ORIGINAL_RIDE_MARKER_BASE64=" + base64.b64encode(data).decode("ascii"))
        signature = b"\x89PNG\r\n\x1a\n"
        self.assertTrue(data.startswith(signature))

        offset = len(signature)
        chunks: list[str] = []
        idat = bytearray()
        ihdr = None
        crc_mismatches: list[str] = []
        repaired = bytearray(signature)

        while offset < len(data):
            self.assertGreaterEqual(len(data) - offset, 12)
            length = struct.unpack(">I", data[offset : offset + 4])[0]
            kind = data[offset + 4 : offset + 8]
            payload_start = offset + 8
            payload_end = payload_start + length
            crc_end = payload_end + 4
            self.assertLessEqual(crc_end, len(data), f"truncated PNG chunk {kind!r}")

            payload = data[payload_start:payload_end]
            expected_crc = struct.unpack(">I", data[payload_end:crc_end])[0]
            actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
            name = kind.decode("ascii")
            if expected_crc != actual_crc:
                crc_mismatches.append(name)

            repaired.extend(struct.pack(">I", length))
            repaired.extend(kind)
            repaired.extend(payload)
            repaired.extend(struct.pack(">I", actual_crc))

            chunks.append(name)
            if name == "IHDR":
                self.assertEqual(length, 13)
                ihdr = struct.unpack(">IIBBBBB", payload)
            elif name == "IDAT":
                idat.extend(payload)

            offset = crc_end
            if name == "IEND":
                break

        self.assertEqual(crc_mismatches, ["IDAT"])
        self.assertIsNotNone(ihdr)
        width, height, bit_depth, color_type, compression, filter_method, interlace = ihdr
        self.assertEqual((width, height), (64, 64))
        self.assertEqual(bit_depth, 8)
        self.assertIn(color_type, (2, 6))
        self.assertEqual(compression, 0)
        self.assertEqual(filter_method, 0)
        self.assertEqual(interlace, 0)

        decoded = zlib.decompress(bytes(idat))
        channels = 4 if color_type == 6 else 3
        self.assertEqual(len(decoded), height * (1 + width * channels))

        repaired_bytes = bytes(repaired)
        original_sha = hashlib.sha256(data).hexdigest()
        repaired_sha = hashlib.sha256(repaired_bytes).hexdigest()
        self.assertNotEqual(original_sha, repaired_sha)

        print(
            "ride_marker_rider_v1.png repair:",
            {
                "bytes": len(data),
                "width": width,
                "height": height,
                "bitDepth": bit_depth,
                "colorType": color_type,
                "interlace": interlace,
                "chunks": chunks,
                "crcMismatches": crc_mismatches,
                "originalSha256": original_sha,
                "repairedSha256": repaired_sha,
            },
        )
        print("REPAIRED_RIDE_MARKER_BASE64=" + base64.b64encode(repaired_bytes).decode("ascii"))

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
