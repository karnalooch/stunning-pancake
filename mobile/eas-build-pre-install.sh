#!/usr/bin/env bash
# EAS monorepo: install from repo root with pnpm (see packageManager in root package.json).
set -euo pipefail
corepack enable
corepack prepare pnpm@9.15.0 --activate
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
