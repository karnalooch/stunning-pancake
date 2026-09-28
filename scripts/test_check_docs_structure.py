from pathlib import Path

from check_docs_structure import duplicate_adr_ids, unexpected_top_level_markdown


def test_duplicate_adr_ids_detects_collision(tmp_path: Path) -> None:
    (tmp_path / "012-first.md").write_text("# one", encoding="utf-8")
    (tmp_path / "012-second.md").write_text("# two", encoding="utf-8")
    (tmp_path / "013-third.md").write_text("# three", encoding="utf-8")

    assert duplicate_adr_ids(tmp_path) == {
        "012": ["012-first.md", "012-second.md"]
    }


def test_duplicate_adr_ids_ignores_index(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text("# index", encoding="utf-8")
    (tmp_path / "016-mobile-performance-budgets.md").write_text("# adr", encoding="utf-8")

    assert duplicate_adr_ids(tmp_path) == {}


def test_unexpected_top_level_markdown_rejects_new_sprawl(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text("# docs", encoding="utf-8")
    (tmp_path / "RANDOM_NEW_PLAN.md").write_text("# nope", encoding="utf-8")

    assert unexpected_top_level_markdown(tmp_path) == ["RANDOM_NEW_PLAN.md"]
