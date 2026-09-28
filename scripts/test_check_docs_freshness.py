from datetime import date
from pathlib import Path

from check_docs_freshness import check_document, extract_last_reviewed


def test_extract_last_reviewed() -> None:
    assert extract_last_reviewed("| **Last reviewed** | 2026-09-28 |") == date(2026, 9, 28)


def test_fresh_document_passes(tmp_path: Path) -> None:
    path = tmp_path / "doc.md"
    path.write_text("| **Last reviewed** | 2026-09-01 |\n", encoding="utf-8")
    assert check_document(path, max_age_days=90, today=date(2026, 9, 28)) == []


def test_stale_document_fails(tmp_path: Path) -> None:
    path = tmp_path / "doc.md"
    path.write_text("| **Last reviewed** | 2026-01-01 |\n", encoding="utf-8")
    errors = check_document(path, max_age_days=90, today=date(2026, 9, 28))
    assert errors and "stale current document" in errors[0]


def test_future_review_date_fails(tmp_path: Path) -> None:
    path = tmp_path / "doc.md"
    path.write_text("| **Last reviewed** | 2026-10-01 |\n", encoding="utf-8")
    errors = check_document(path, max_age_days=90, today=date(2026, 9, 28))
    assert errors and "in the future" in errors[0]


def test_missing_metadata_fails(tmp_path: Path) -> None:
    path = tmp_path / "doc.md"
    path.write_text("# no metadata\n", encoding="utf-8")
    errors = check_document(path, max_age_days=90, today=date(2026, 9, 28))
    assert errors and "missing Last reviewed metadata" in errors[0]
