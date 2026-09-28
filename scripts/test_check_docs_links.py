"""Unit tests for docs links plus small cross-component CI smoke contracts."""

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


def test_check_file_skips_template_placeholder(fixture_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("check_docs_links.REPO", fixture_dir)
    sample = fixture_dir / "docs" / "quality" / "template.md"
    sample.write_text("[FAQ]([FAQ_LINK])\n", encoding="utf-8")
    assert check_file(sample) == []


def test_check_file_accepts_github_line_range(fixture_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("check_docs_links.REPO", fixture_dir)
    sample = fixture_dir / "docs" / "quality" / "line-range.md"
    sample.write_text("[target](./target.md:10-12)\n", encoding="utf-8")
    assert check_file(sample) == []


def test_t71_redaction_is_wired_before_external_log_sinks() -> None:
    """DS-017 must not regress to raw Sentry/Crashlytics/telemetry payloads."""

    backend_sentry = (REPO / "backend" / "core" / "sentry.py").read_text(encoding="utf-8")
    telemetry_main = (REPO / "telemetry" / "main.py").read_text(encoding="utf-8")
    mobile_index = (REPO / "mobile" / "index.ts").read_text(encoding="utf-8")
    firebase = (REPO / "mobile" / "src" / "services" / "FirebaseService.ts").read_text(
        encoding="utf-8"
    )

    assert "install_log_redaction()" in backend_sentry
    assert "before_send=redact_sentry_event" in backend_sentry

    install_at = telemetry_main.index("install_log_redaction()")
    logging_at = telemetry_main.index("logging.basicConfig")
    assert install_at < logging_at

    redaction_import_at = mobile_index.index("./src/security/installRedaction")
    app_import_at = mobile_index.index("./App")
    assert redaction_import_at < app_import_at

    assert "redactError" in firebase
    assert "redactValue" in firebase
    assert "recordError(safeError)" in firebase
    assert "analytics.logEvent(safeName, safeParams)" in firebase
    assert "recordError(err" not in firebase
    assert "analytics.logEvent(name, params)" not in firebase

def test_legal_metadata_does_not_overclaim_project_license_or_gdpr() -> None:
    """Public source availability and product controls must not masquerade as legal proof."""

    settings = (REPO / "backend" / "core" / "settings.py").read_text(encoding="utf-8")
    constitution_en = (REPO / "docs" / "en" / "CONSTITUTION.md").read_text(encoding="utf-8")
    constitution_pl = (REPO / "docs" / "pl" / "CONSTITUTION.md").read_text(encoding="utf-8")

    assert '"LICENSE": {"name": "MIT License"}' not in settings

    assert "open-source, self-hosted ecosystem" not in constitution_en
    assert "Full compliance with **GDPR**" not in constitution_en
    assert "Minimum 3 years** (GDPR requirement)" not in constitution_en
    assert "no project-wide software license is declared" in constitution_en
    assert "GDPR readiness is pre-production and gate-controlled" in constitution_en

    assert "otwartoźródłowy, samohostowany ekosystem" not in constitution_pl
    assert "Pełna zgodność z **RODO/GDPR**" not in constitution_pl
    assert "Minimum 3 lata** (wymóg RODO)" not in constitution_pl
    assert "nie deklaruje licencji obejmującej cały projekt" in constitution_pl
    assert "Gotowość RODO/GDPR ma status pre-production" in constitution_pl

