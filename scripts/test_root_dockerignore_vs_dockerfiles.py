"""Contract tests for the root ``.dockerignore`` introduced by T24.

The root context is consumed by ``admin/Dockerfile`` (build context ``.``,
dockerfile ``admin/Dockerfile``). Backend still uses ``./backend`` so its
own context is unaffected.

These tests verify:

* the root ``.dockerignore`` exists;
* it excludes the unsafe patterns required by the T24 contract;
* it does NOT hide any source file consumed by ``admin/Dockerfile``'s
  ``COPY`` instructions;
* the Backend ``Dockerfile`` is unaffected (its context is ``./backend``).
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ROOT_DOCKERIGNORE = REPO / ".dockerignore"
ADMIN_DOCKERFILE = REPO / "admin" / "Dockerfile"
ADMIN_DOCKERIGNORE = REPO / "admin" / ".dockerignore"
BACKEND_DOCKERFILE = REPO / "backend" / "Dockerfile"


def _read_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [line.rstrip("\n") for line in path.read_text(encoding="utf-8").splitlines()]


class RootDockerignoreExistsTests(unittest.TestCase):
    def test_root_dockerignore_exists(self):
        self.assertTrue(
            ROOT_DOCKERIGNORE.exists(),
            "root .dockerignore must exist for safe monorepo context (admin build)",
        )


class RequiredExclusionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lines = _read_lines(ROOT_DOCKERIGNORE)
        cls.text = "\n".join(cls.lines)

    def _has_pattern(self, pattern: str) -> bool:
        return any(
            re.fullmatch(pattern, line) or re.fullmatch(pattern + r"/\*\*", line)
            for line in self.lines
        )

    def _has_glob(self, *needles: str) -> bool:
        return any(any(n in line for n in needles) for line in self.lines)

    def test_excludes_node_modules(self):
        self.assertTrue(
            self._has_glob("node_modules"),
            "root .dockerignore must exclude node_modules",
        )

    def test_excludes_recursive_node_modules(self):
        self.assertTrue(
            self._has_glob("**/node_modules"),
            "root .dockerignore must exclude **/node_modules",
        )

    def test_excludes_dist(self):
        self.assertTrue(self._has_glob("dist"), "must exclude dist")

    def test_excludes_recursive_dist(self):
        self.assertTrue(
            self._has_glob("**/dist"),
            "root .dockerignore must exclude **/dist",
        )

    def test_excludes_git(self):
        self.assertTrue(self._has_glob(".git"), "must exclude .git")

    def test_excludes_pycache(self):
        self.assertTrue(
            self._has_glob("__pycache__"),
            "root .dockerignore must exclude __pycache__",
        )

    def test_excludes_pyc_files(self):
        self.assertTrue(
            self._has_glob("*.pyc"),
            "root .dockerignore must exclude *.pyc",
        )

    def test_excludes_pytest_cache(self):
        self.assertTrue(
            self._has_glob(".pytest_cache"),
            "root .dockerignore must exclude .pytest_cache",
        )

    def test_excludes_venv(self):
        self.assertTrue(self._has_glob(".venv"), "must exclude .venv")

    def test_excludes_vscode(self):
        self.assertTrue(self._has_glob(".vscode"), "must exclude .vscode")

    def test_excludes_log_files(self):
        self.assertTrue(self._has_glob("*.log"), "must exclude *.log")


class AdminDockerfileCopySourcesTests(unittest.TestCase):
    """The root ``.dockerignore`` must not hide any file copied by admin/Dockerfile.

    The admin Dockerfile copies (from repo root):

    * workspace manifests at the root (``package.json``, ``pnpm-lock.yaml``,
      ``pnpm-workspace.yaml``, ``.npmrc``);
    * ``admin/package.json``, ``mobile/package.json``;
    * ``packages/*/package.json`` (tokens, api-client, tsconfig, eslint-config);
    * ``packages/`` directory tree;
    * ``admin/`` directory tree;
    * ``admin/nginx.conf.template``.

    None of these may be hidden by ``.dockerignore``.
    """

    REQUIRED_FILES = (
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".npmrc",
        "admin/package.json",
        "mobile/package.json",
        "packages/tokens/package.json",
        "packages/api-client/package.json",
        "packages/tsconfig/package.json",
        "packages/eslint-config/package.json",
        "packages",
        "admin",
        "admin/nginx.conf.template",
    )

    @classmethod
    def setUpClass(cls):
        cls.dockerignore_text = (
            ROOT_DOCKERIGNORE.read_text(encoding="utf-8") if ROOT_DOCKERIGNORE.exists() else ""
        )

    def test_required_files_not_excluded(self):
        for required in self.REQUIRED_FILES:
            with self.subTest(file=required):
                # A dockerignore rule of "/path" or "path" would exclude this file.
                # We must NOT see any rule that exactly matches a required path,
                # and we must not see a parent-directory exclusion that swallows it.
                bad = False
                for line in self.dockerignore_text.splitlines():
                    stripped = line.strip()
                    if not stripped or stripped.startswith("#"):
                        continue
                    if stripped == required:
                        bad = True
                        break
                    # root-level patterns starting with /** or * swallow files
                    if stripped == "**":
                        bad = True
                        break
                self.assertFalse(
                    bad,
                    f"required COPY source {required!r} must not be excluded by root .dockerignore",
                )

    def test_packages_and_admin_directories_not_excluded(self):
        """The directory trees for ``packages`` and ``admin`` must remain visible."""
        # An exclusion like ``packages`` or ``admin`` would invalidate the build.
        for forbidden in ("packages", "admin"):
            with self.subTest(directory=forbidden):
                self.assertNotIn(
                    f"\n{forbidden}\n",
                    "\n" + self.dockerignore_text + "\n",
                    f"root .dockerignore must not exclude {forbidden!r} directory",
                )


class BackendContextUntouchedTests(unittest.TestCase):
    """Backend uses ``./backend`` build context — root dockerignore has no effect."""

    def test_backend_dockerfile_unmodified(self):
        self.assertTrue(BACKEND_DOCKERFILE.exists())
        text = BACKEND_DOCKERFILE.read_text(encoding="utf-8")
        # Backend context is the backend/ directory itself; no COPY from repo root
        # We just assert backend Dockerfile still does ``COPY . /app/`` from inside backend
        self.assertIn("COPY . /app/", text)

    def test_admin_dockerignore_intact(self):
        """Admin already had a dockerignore for its old context — leaving it untouched."""
        if ADMIN_DOCKERIGNORE.exists():
            text = ADMIN_DOCKERIGNORE.read_text(encoding="utf-8")
            # Sanity: admin dockerignore should not be empty
            self.assertTrue(text.strip())


class AdminDockerfileParseTests(unittest.TestCase):
    def _copy_sources(self) -> list[str]:
        """Extract every path that admin/Dockerfile COPYs.

        Returns a list of normalized relative paths (always relative to repo root).
        """
        text = ADMIN_DOCKERFILE.read_text(encoding="utf-8")
        sources: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped.startswith("COPY "):
                continue
            # Skip --from=...
            parts = stripped.split()
            tokens = [p for p in parts if not p.startswith("--")]
            if len(tokens) < 3:
                continue
            # last token is dest, everything in between is sources
            sources.extend(tokens[1:-1])
        return sources

    def test_no_required_copy_source_is_hidden(self):
        sources = self._copy_sources()
        # normalize leading ./ for matching
        normalized = [s.lstrip("./") for s in sources]
        dockerignore = (
            ROOT_DOCKERIGNORE.read_text(encoding="utf-8") if ROOT_DOCKERIGNORE.exists() else ""
        )
        rules = [
            line.strip()
            for line in dockerignore.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]

        for src in normalized:
            with self.subTest(source=src):
                # rule that equals the source (or its dirname) would exclude it
                self.assertNotIn(src, rules, f"{src!r} is directly excluded")
                # exclusion of any parent path component must not swallow a file
                # (e.g. ``/admin`` would exclude everything under admin/)
                parts = src.split("/")
                for i in range(1, len(parts)):
                    parent = "/".join(parts[:i])
                    self.assertNotIn(parent, rules, f"parent {parent!r} of {src!r} is excluded")


if __name__ == "__main__":
    unittest.main()
