"""Fail-closed contract for the repository production Compose backend build.

The historical production Compose file referenced backend/Dockerfile.prod even
though that file did not exist. These tests deliberately avoid a YAML parser so
they can run in the lightweight scripts CI job with only the Python standard
library.
"""

from __future__ import annotations

import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
COMPOSE = REPO / "docker-compose.prod.yml"


def _backend_build_values() -> tuple[str, str]:
    context: str | None = None
    dockerfile: str | None = None
    in_backend = False
    in_build = False

    for raw in COMPOSE.read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        indent = len(raw) - len(raw.lstrip(" "))

        if indent == 2 and stripped.endswith(":"):
            in_backend = stripped == "backend:"
            in_build = False
            continue

        if not in_backend:
            continue

        if indent == 4 and stripped == "build:":
            in_build = True
            continue

        if in_build and indent <= 4 and stripped:
            break

        if in_build and indent == 6:
            if stripped.startswith("context:"):
                context = stripped.split(":", 1)[1].strip().strip("'\"")
            elif stripped.startswith("dockerfile:"):
                dockerfile = stripped.split(":", 1)[1].strip().strip("'\"")

    if not context or not dockerfile:
        raise AssertionError(
            "docker-compose.prod.yml backend.build must define both context and dockerfile"
        )
    return context, dockerfile


class ProductionComposeBackendBuildContractTests(unittest.TestCase):
    def test_backend_compose_dockerfile_exists_inside_declared_context(self):
        context, dockerfile = _backend_build_values()
        context_path = (REPO / context).resolve()
        dockerfile_path = (context_path / dockerfile).resolve()

        self.assertTrue(context_path.is_dir(), f"backend build context does not exist: {context}")
        try:
            dockerfile_path.relative_to(context_path)
        except ValueError:
            self.fail(
                f"backend dockerfile must stay inside its build context: {dockerfile_path}"
            )

        self.assertTrue(
            dockerfile_path.is_file(),
            f"production Compose references missing backend Dockerfile: {dockerfile_path}",
        )

    def test_backend_image_uses_the_repository_runtime_entrypoint(self):
        context, dockerfile = _backend_build_values()
        context_path = (REPO / context).resolve()
        dockerfile_text = (context_path / dockerfile).read_text(encoding="utf-8")
        entrypoint = context_path / "docker-entrypoint.sh"

        self.assertTrue(entrypoint.is_file(), "backend runtime entrypoint must exist")
        self.assertIn(
            'ENTRYPOINT ["/app/docker-entrypoint.sh"]',
            dockerfile_text,
            "backend Dockerfile must launch through docker-entrypoint.sh",
        )
        self.assertIn(
            "exec gunicorn",
            entrypoint.read_text(encoding="utf-8"),
            "production web entrypoint must hand off to Gunicorn",
        )

    def test_historical_missing_production_dockerfile_reference_does_not_return(self):
        text = COMPOSE.read_text(encoding="utf-8")
        self.assertNotIn(
            "Dockerfile.prod",
            text,
            "Dockerfile.prod does not exist; use the maintained backend Dockerfile",
        )


if __name__ == "__main__":
    unittest.main()
