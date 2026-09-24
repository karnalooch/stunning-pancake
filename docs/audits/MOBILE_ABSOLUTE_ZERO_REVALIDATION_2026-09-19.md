# Mobile absolute-zero revalidation

Tracker: #157.

This runbook intentionally assumes nothing about the previous Android/Metro/EAS runtime state. Repo-side platform normalization (#159), Android harness hardening (#161), and MMKV v4/Nitro migration (#163) are already on `main`; this collector is for the remaining owner-machine/runtime proof.

## Status update — 2026-09-24

The physical GPS/MMKV durability items that were still open when this runbook was written are now accepted:

- encrypted GPS payload recovery across process death — PASS via PR #256;
- lost encryption-key fail-closed behavior — PASS via PR #258: https://github.com/karnalooch/stunning-pancake/pull/258#issuecomment-5802377295;
- locked/background GPS durability, including a real accepted point while locked/backgrounded and same-activity recovery after force-stop/relaunch — PASS via PR #259: https://github.com/karnalooch/stunning-pancake/pull/259#issuecomment-5809822966.

Protected `main` after #259 is `30c0d4cb9502f6d92f75a5fd633e7624c213f809`.

These proofs do **not** close the full absolute-zero tracker. Remaining release-trust work stays in #156/#157: canonical clean prebuild/package/version/runtimeVersion provenance, deterministic full Ride lifecycle smoke, and final exact-artifact re-proof.

## First capture

Keep the checkout being inspected untouched. Run the collector from an isolated worktree so the evidence script itself does not need to be copied into the checkout under test.

From the current 4VELO checkout:

```powershell
$RepoRoot = (git rev-parse --show-toplevel).Trim()
$AuditRoot = Join-Path (Split-Path $RepoRoot -Parent) "stunning-pancake-mobile-audit"

git fetch origin audit/mobile-zero-baseline
git worktree add $AuditRoot origin/audit/mobile-zero-baseline

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $AuditRoot "scripts/mobile-zero-baseline.ps1") `
  -RepoRootPath $RepoRoot
```

If `$AuditRoot` already exists as a worktree, do not add it again; verify that worktree points at the current `audit/mobile-zero-baseline` head and run the collector from there.

The collector is read-only with respect to the inspected repository and toolchain. It does not install, repair, build, start, stop, kill, or reconfigure anything. The JSON report is written under `%TEMP%` by default.

The report sanitizes likely credentials in Git remotes/process arguments, replaces the current user-profile prefix with `%USERPROFILE%`, redacts test credentials, and stores only a short SHA-256-derived identifier for each ADB serial. Do not post-process the report to add secrets or raw device identifiers.

Do **not** run dependency repair before preserving this first report.

## Optional ecosystem checks

Only after the initial offline/read-only capture:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $AuditRoot "scripts/mobile-zero-baseline.ps1") `
  -RepoRootPath $RepoRoot `
  -RunNetworkChecks
```

This opt-in mode may use network/cache access for the repository-pinned Expo Doctor (`1.20.4`) and `expo install --check`. Record its output separately.

## Windows toolchain fallback: portable exact Node

If the host Node does not satisfy the repository engine range and there is no already-working version manager, do not weaken the repository constraint and do not install another global Node manager just for the proof.

Use the official Node.js Windows x64 ZIP for the exact proof version (`24.21.0`) as a user-local, session-scoped toolchain:

1. Download `node-v24.21.0-win-x64.zip` and the matching official `SHASUMS256.txt` from the Node.js v24.21.0 release directory.
2. Verify the ZIP SHA-256 against the `node-v24.21.0-win-x64.zip` line in that file before extracting.
3. Extract under a user-writable directory such as `%LOCALAPPDATA%\\4velo-toolchains\\node-v24.21.0-win-x64`.
4. Prepend that extracted directory to the **current PowerShell process** `PATH` only. Do not persist PATH changes and do not uninstall the machine-global Node.
5. Verify `node --version` resolves to `v24.21.0` and `where.exe node` lists the portable path first.
6. Use the Corepack distributed with that Node installation and activate exactly `pnpm@12.4.2`.
7. Verify `pnpm --version` returns `12.4.2` before any install.

This fallback is deliberately host-independent so the same proof procedure can be reproduced on both owner Windows machines without depending on NVM/Volta/Scoop state.

## Evidence policy

A mobile claim is PASS only when it is tied to:

- exact Git SHA and worktree status;
- repository-declared Node/pnpm/Expo/RN/MMKV/Nitro versions;
- exact host/tool versions;
- exact app/build identity;
- exact profile/environment/channel where applicable;
- reproducible command;
- captured output.

Old screenshots, cached APK behavior, and green static CI are supporting evidence only, not runtime proof.

## Order after first capture

1. Review Z0/Z1 host/toolchain and exact checkout provenance.
2. Run root `pnpm install --frozen-lockfile`; prove manifests/lockfile remain unchanged.
3. Capture a second baseline and compare module resolution.
4. Run/review the pinned Expo Doctor and dependency compatibility checks.
5. Start Metro freshly **from `mobile/`**, using the canonical dev-client command.
6. Install/launch the exact dev-client artifact and prove it requests that fresh bundle.
7. Record exact Git SHA, app version/runtime boundary, package id, device/emulator identity, and artifact identity.
8. Treat the accepted #256/#258/#259 MMKV/GPS physical proofs as completed evidence; do not re-open them mechanically.
9. Complete #156 canonical native-generation/package/version/runtimeVersion and exact-artifact provenance.
10. Execute the deterministic Ride smoke: Start -> Active -> Pause -> Resume -> Finish -> Summary -> Home.
11. Re-run the final exact-artifact proof on the corrected canonical build path.
12. UI review may now resume on a refreshed #147 branch, but final mobile release sign-off still waits for the remaining #156/#157 gates.

Do not skip directly to UI.
