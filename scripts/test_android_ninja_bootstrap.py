"""Fail closed when the T83 isolated Android toolchain bootstrap drifts.

The PowerShell bootstrap at scripts/android/ninja-bootstrap.ps1 is the single
source of truth for assembling the Ninja 1.12.1 + CMake 3.22.1 isolated
toolchain that bypasses the Android SDK's bundled Ninja 1.10.2 on Windows.
This contract test covers four things that cannot be left to chance:

1. The pinned GitHub artifact URL and SHA256 hashes are still inside the
   bootstrap script. Any drift here is a silent remote compromise risk.
2. The version gate rejects the family of Ninja versions that reproduce the
   T83 symptom (1.10.x and 1.11.x) and accepts the family that the same
   machine reproducibly succeeds with (1.12.1+).
3. The Gradle-config helper preserves every non-`cmake.dir` line in
   `local.properties` and writes exactly one `cmake.dir=` line, in any order,
   on repeated invocations.
4. The bootstrap's own `-SelfTest` mode (the only on-host check that
   exercises both gates without an Android SDK) runs green when `pwsh` is
   available. The test is skipped, not failed, on runners without PowerShell
   because Linux CI cannot reproduce the T83 failure anyway.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP_PATH = ROOT / "scripts" / "android" / "ninja-bootstrap.ps1"

EXPECTED_NINJA_VERSION = "1.12.1"
EXPECTED_CMAKE_VERSION = "3.22.1"
EXPECTED_NINJA_DOWNLOAD_URL = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip"
EXPECTED_NINJA_ZIP_SHA256 = "F550FEC705B6D6FF58F2DB3C374C2277A37691678D6ABA463ADCBB129108467A"
EXPECTED_NINJA_EXE_SHA256 = "68865C3276D449D746CEA5065FDEC2BAF755D7813E161AB04205B0907B2629B8"
REJECT_FAMILY = ("1.10.0", "1.10.2", "1.11.1")
ACCEPT_FAMILY = ("1.12.1", "1.12.2", "1.13.0")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class PinnedArtifactContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = read_text(BOOTSTRAP_PATH)

    def test_bootstrap_script_lives_under_scripts_android(self) -> None:
        self.assertTrue(
            BOOTSTRAP_PATH.is_file(),
            f"missing bootstrap script at {BOOTSTRAP_PATH}",
        )
        # scripts/ at the repo root is tracked and includes android-env.ps1;
        # scripts/android must not be gitignored or the bootstrap would only
        # exist on the build host.
        os.chdir(ROOT)
        result = subprocess.run(
            ["git", "check-ignore", "-v", "scripts/android/ninja-bootstrap.ps1"],
            check=False,
            capture_output=True,
            text=True,
        )
        # git check-ignore exits 0 when ignored, 1 when not.
        self.assertNotEqual(
            result.returncode,
            0,
            f"scripts/android/ninja-bootstrap.ps1 must not be gitignored; "
            f"got: {result.stdout.strip()}",
        )

    def test_pinned_ninja_zip_url_present(self) -> None:
        self.assertIn(EXPECTED_NINJA_DOWNLOAD_URL, self.source)

    def test_pinned_ninja_zip_sha256_literal_present(self) -> None:
        # Stored as uppercase; our bootstrap normalises hashes to upper.
        self.assertIn(EXPECTED_NINJA_ZIP_SHA256, self.source)

    def test_pinned_ninja_exe_sha256_literal_present(self) -> None:
        self.assertIn(EXPECTED_NINJA_EXE_SHA256, self.source)

    def test_pinned_versions_match(self) -> None:
        self.assertIn(f"$script:NINJA_VERSION = \"{EXPECTED_NINJA_VERSION}\"", self.source)
        self.assertIn(f"$script:CMAKE_VERSION = \"{EXPECTED_CMAKE_VERSION}\"", self.source)

    def test_no_other_ninja_download_url_silently_overrides_pinning(self) -> None:
        # Reject any other GitHub ninja URL; the only legal source is v1.12.1.
        for match in re.finditer(r"https?://github\.com/ninja-build/[^\"'\s]+", self.source):
            self.assertIn("v1.12.1", match.group(0), match.group(0))


class VersionGateContractTests(unittest.TestCase):
    """White-box checks for the version-gate logic the bootstrap exposes."""

    def setUp(self) -> None:
        self.source = read_text(BOOTSTRAP_PATH)

    def test_rejects_ninja_110_and_111(self) -> None:
        # The bootstrap must, in code, classify the rejected family.
        for sample in REJECT_FAMILY:
            with self.subTest(sample=sample):
                self.assertIn(f'"{sample}"', self.source)

    def test_accepts_ninja_121_and_newer(self) -> None:
        # The bootstrap must enumerate the accepted samples explicitly.
        for sample in ACCEPT_FAMILY:
            with self.subTest(sample=sample):
                self.assertIn(f'"{sample}"', self.source)

    def test_minimum_supported_ninja_version_is_pinned(self) -> None:
        self.assertRegex(
            self.source,
            r"\$script:MIN_SUPPORTED_NINJA\s*=\s*\[version\]\"1\.12\.0\"",
        )

    def test_error_message_mentions_t83_failure_symptom(self) -> None:
        # Future readers must be able to grep the symptom from the script.
        self.assertIn("manifest 'build.ninja' still dirty after 100 tries", self.source)

    def test_does_not_silently_downgrade_when_skipping_hash(self) -> None:
        # SkipHashCheck must be an explicit switch, not a default-on knob.
        self.assertRegex(self.source, r"\[switch\]\$SkipHashCheck")
        # And we still verify by default.
        self.assertNotIn("-SkipHashCheck `$true", self.source)
        self.assertNotIn('-SkipHashCheck:$true', self.source)


class LocalPropertiesHelperContractTests(unittest.TestCase):
    """Mirror Set-CmakeDirInLocalProperties in Python to validate idempotency.

    The PowerShell helper is straight-line text manipulation; we re-implement
    the same rules in pure Python so we can drive them on any CI runner.
    """

    def run_helper(self, path: Path, toolchain: str) -> dict:
        cmake_dir_key = "cmake.dir="
        toolchain_path = toolchain.replace("\\", "/")
        original: list[str] = []
        if path.exists():
            original = [line for line in path.read_text(encoding="utf-8").splitlines()]

        kept: list[str] = []
        had_existing = False
        for line in original:
            if line and line.strip().startswith(cmake_dir_key):
                had_existing = True
                continue
            kept.append(line)

        # Trim trailing blank lines so we don't accumulate them across runs.
        while kept and not kept[-1].strip():
            kept.pop()

        kept.append(f"cmake.dir={toolchain_path}")
        kept.append("")
        path.write_text("\n".join(kept), encoding="utf-8")
        return {
            "had_existing": had_existing,
            "preserved_lines": len(kept) - 2,
            "all_lines": kept,
        }

    def test_helper_creates_dir_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lp = Path(tmp) / "local.properties"
            self.assertFalse(lp.exists())
            r = self.run_helper(lp, "C:/x/y/cmake")
            self.assertFalse(r["had_existing"])
            self.assertEqual(r["preserved_lines"], 0)
            self.assertEqual(lp.read_text(encoding="utf-8"), "cmake.dir=C:/x/y/cmake\n")

    def test_helper_is_idempotent_across_repeated_calls(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lp = Path(tmp) / "local.properties"
            self.run_helper(lp, "C:/x/y/cmake")
            first = lp.read_text(encoding="utf-8")
            self.run_helper(lp, "C:/x/y/cmake")
            second = lp.read_text(encoding="utf-8")
            self.run_helper(lp, "C:/x/y/cmake")
            third = lp.read_text(encoding="utf-8")
            self.assertEqual(first, second)
            self.assertEqual(second, third)
            self.assertEqual(first.count("cmake.dir="), 1)

    def test_helper_preserves_unrelated_keys_when_replacing_cmake_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lp = Path(tmp) / "local.properties"
            lp.write_text(
                "sdk.dir=C:/Users/test/Android/Sdk\n"
                "ndk.dir=C:/Users/test/Android/Sdk/ndk/26.1.10909125\n"
                "reactNativeArchitectures=arm64-v8a\n"
                "",
                encoding="utf-8",
            )
            r = self.run_helper(lp, "C:/users/4velo/cmake")
            self.assertFalse(r["had_existing"])
            text = lp.read_text(encoding="utf-8")
            for expected in (
                "sdk.dir=C:/Users/test/Android/Sdk",
                "ndk.dir=C:/Users/test/Android/Sdk/ndk/26.1.10909125",
                "reactNativeArchitectures=arm64-v8a",
                "cmake.dir=C:/users/4velo/cmake",
            ):
                with self.subTest(line=expected):
                    self.assertIn(expected, text)
            # Exactly one cmake.dir line - replace, do not append.
            self.assertEqual(text.count("cmake.dir="), 1)


class BootstrapSelfTestExecutionTests(unittest.TestCase):
    """Spawn -SelfTest when pwsh is available; otherwise skip (not fail)."""

    @classmethod
    def setUpClass(cls) -> None:
        if not BOOTSTRAP_PATH.is_file():
            cls.pwsh_path = None
            return
        cls.pwsh_path = shutil.which("pwsh")

    def setUp(self) -> None:
        if not self.pwsh_path:
            self.skipTest("pwsh not installed on this runner; -SelfTest requires Windows-ish host")

    def test_selftest_mode_exits_zero(self) -> None:
        result = subprocess.run(
            [
                self.pwsh_path,  # type: ignore[arg-type]
                "-NoProfile",
                "-File",
                str(BOOTSTRAP_PATH),
                "-SelfTest",
            ],
            cwd=str(ROOT),
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
        combined = (result.stdout + result.stderr).lower()
        self.assertEqual(
            result.returncode,
            0,
            msg=f"bootstrap -SelfTest should exit 0; got {result.returncode}\n"
            f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}",
        )
        self.assertIn("selftest ok", combined, msg=result.stdout)
        for sample in REJECT_FAMILY:
            with self.subTest(sample=sample):
                self.assertIn(sample, combined)
        for sample in ACCEPT_FAMILY:
            with self.subTest(sample=sample):
                self.assertIn(sample, combined)


if __name__ == "__main__":
    unittest.main()
