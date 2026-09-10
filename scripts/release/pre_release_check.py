import sys
from pathlib import Path

REQUIRED_FILES = [
    "docs/en/operations/PRE_RELEASE_VERIFICATION.md",
    "docs/pl/operations/PRE_RELEASE_VERIFICATION.md",
    ".env.home.example",
    "docker-compose.yml",
    "backend/docker-entrypoint.sh",
    "scripts/home_lab.py",
    "docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md",
]


def check_files(paths: list[str]) -> tuple[bool, list[str]]:
    missing = [path for path in paths if not Path(path).exists()]
    return (len(missing) == 0, missing)


def main() -> int:
    ok_docs, missing_docs = check_files(REQUIRED_FILES)

    if not ok_docs:
        print("Missing release gate files:")
        for path in missing_docs:
            print(f"- {path}")

    if ok_docs:
        print("Home-lab release artifacts present.")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
