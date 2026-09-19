# Mobile absolute-zero revalidation

Tracker: #157.

This runbook intentionally assumes nothing about the previous Android/Metro/EAS state.

## First command

From repository root on the Windows machine:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-zero-baseline.ps1
```

The command is read-only with respect to the repository and local toolchain. It does not install, repair, build, start, stop or reconfigure anything. The JSON report is written under `%TEMP%` and the path is printed at the end.

Do **not** run dependency repair before preserving this first report.

## Optional ecosystem checks

Only after the initial offline/read-only capture:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-zero-baseline.ps1 -RunNetworkChecks
```

This opt-in mode may use network/cache access for Expo Doctor / Expo dependency checks. Record its output separately.

## Evidence policy

A mobile claim is PASS only when it is tied to:

- exact Git SHA;
- worktree status;
- exact host/tool versions;
- exact app/build identity;
- exact profile/environment/channel where applicable;
- reproducible command;
- captured output.

Old screenshots, cached APK behavior and green static CI are supporting evidence only, not runtime proof.

## Order after first capture

1. Review host/toolchain drift.
2. Review physical `node_modules` resolution.
3. Run frozen root install and capture a second report.
4. Review Expo Doctor / dependency compatibility.
5. Resolve EAS/Expo SSOT.
6. Generate/inspect native config.
7. Prove clean Metro bundle.
8. Prove exact emulator/dev-client connection.
9. Only then execute application smoke/visual review.

Do not skip directly to UI.
