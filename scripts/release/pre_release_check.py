from pathlib import Path
import sys


REQUIRED_FILES = [
    "docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md",
    "docs/operations/PRE_RELEASE_VERIFICATION.md",
    "docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md",
    "infrastructure/k8s/kustomization.yaml",
]

REQUIRED_K8S_MANIFESTS = [
    "infrastructure/k8s/namespace.yaml",
    "infrastructure/k8s/config/app-configmap.yaml",
    "infrastructure/k8s/config/app-secrets.template.yaml",
    "infrastructure/k8s/workloads/api.yaml",
    "infrastructure/k8s/workloads/worker.yaml",
    "infrastructure/k8s/workloads/worker-simulation.yaml",
    "infrastructure/k8s/workloads/beat.yaml",
    "infrastructure/k8s/workloads/redis.yaml",
    "infrastructure/k8s/workloads/brouter.yaml",
    "infrastructure/k8s/network/ingress.yaml",
]


def check_files(paths: list[str]) -> tuple[bool, list[str]]:
    missing = [path for path in paths if not Path(path).exists()]
    return (len(missing) == 0, missing)


def main() -> int:
    ok_docs, missing_docs = check_files(REQUIRED_FILES)
    ok_manifests, missing_manifests = check_files(REQUIRED_K8S_MANIFESTS)

    if not ok_docs:
        print("Missing release gate files:")
        for path in missing_docs:
            print(f"- {path}")

    if not ok_manifests:
        print("Missing Kubernetes manifest files:")
        for path in missing_manifests:
            print(f"- {path}")

    if ok_docs and ok_manifests:
        print("Pre-release gate artifacts present.")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
