from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("versioning", REPO / "scripts" / "versioning.py")
assert SPEC and SPEC.loader
versioning = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(versioning)


class VersioningContractTests(unittest.TestCase):
    def test_repository_version_contract_is_consistent(self):
        self.assertEqual(versioning.check_contract(), [])

    def test_current_product_label(self):
        release = versioning.load_release()
        self.assertEqual(release["version"], "0.3.3")
        self.assertEqual(release["prerelease"], "dev")
        self.assertEqual(versioning.semver_label(release), "0.3.3-dev")

    def test_stable_tag_is_rejected_during_prerelease_cycle(self):
        errors = versioning.check_contract(tag="v0.3.3")
        self.assertTrue(any("forbidden while prerelease" in error for error in errors))

    def test_bad_tag_is_rejected(self):
        errors = versioning.check_contract(tag="v0.3.4")
        self.assertTrue(any("expected \'v0.3.3\'" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
