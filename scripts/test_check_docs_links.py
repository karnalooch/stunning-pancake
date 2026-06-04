"""Unit tests for scripts/check_docs_links.py link parser (Q-P1-5b)."""

from __future__ import annotations

from pathlib import Path

import pytest
from check_docs_links import REPO, check_file


@pytest.fixture
def fixture_dir(tmp_path: Path) -> Path:
    docs = tmp_path / "docs" / "quality"
    docs.mkdir(parents=True)
    target = tmp_path / "docs" / "quality" / "target.md"
    target.write_text("# ok\n", encoding="utf-8")
    broken = docs / "broken.md"
    broken.write_text("[x](./missing.md)\n", encoding="utf-8")
    good = docs / "good.md"
    good.write_text("[y](./target.md)\n", encoding="utf-8")
    return tmp_path


def test_check_file_reports_broken_relative_link(fixture_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("check_docs_links.REPO", fixture_dir)
    broken = fixture_dir / "docs" / "quality" / "broken.md"
    errors = check_file(broken)
    assert len(errors) == 1
    assert "missing.md" in errors[0]


def test_check_file_ok_for_existing_relative_link(fixture_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("check_docs_links.REPO", fixture_dir)
    good = fixture_dir / "docs" / "quality" / "good.md"
    assert check_file(good) == []


def test_check_file_skips_http_and_anchor() -> None:
    md = REPO / "docs" / "quality" / "README.md"
    if not md.is_file():
        pytest.skip("README not in repo")
    sample = md.parent / "_link_test_sample.md"
    sample.write_text(
        "[ext](https://example.com)\n[hash](#section)\n",
        encoding="utf-8",
    )
    try:
        assert check_file(sample) == []
    finally:
        sample.unlink(missing_ok=True)
