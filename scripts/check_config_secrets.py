"""Reject embedded signing keys in tracked Railway configuration; never print values."""
import json
import subprocess
from pathlib import Path


def violations(content):
    config = json.loads(content)
    variables = config.get("variables", {})
    return [name for name in ("SECRET_KEY", "JWT_SIGNING_KEY") if name in variables]


def main():
    root = Path(__file__).resolve().parents[1]
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "*railway.json"], cwd=root
    ).decode().split("\0")
    errors = []
    for relative in filter(None, paths):
        try:
            names = violations((root / relative).read_text())
        except (OSError, ValueError):
            errors.append(f"{relative}: cannot validate JSON")
            continue
        errors.extend(f"{relative}: configure {name} in the service secret store" for name in names)
    for error in errors:
        print(error)
    if not errors:
        print("OK — no embedded signing-key fields in tracked Railway configuration")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
