# Mobile absolute-zero revalidation

Tracker: #157.

This runbook intentionally assumes nothing about the previous Android/Metro/EAS state.

## First command

The collector may live in its isolated PR #158 worktree while inspecting the exact checkout under test. Prefer this form until the collector itself is merged:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass `
  -File D:\gem\stunning-pancake-mobile-audit\scripts\mobile-zero-baseline.ps1 `
  -RepoRootPath D:\gem\stunning-pancake
```

If the collector is later present in the exact checkout being tested, `-RepoRootPath` may be omitted.

The command is read-only with respect to the inspected repository and local toolchain. It does not install, repair, build, start, stop or reconfigure anything. The JSON report is written under `%TEMP%` and the path is printed at the end. The report records both the collector worktree and the inspected repository root so provenance is explicit.

Do **not** run dependency repair before preserving this first report.

## Optional ecosystem checks

Only after the initial offline/read-only capture:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass `
  -File D:\gem\stunning-pancake-mobile-audit\scripts\mobile-zero-baseline.ps1 `
  -RepoRootPath D:\gem\stunning-pancake `
  -RunNetworkChecks
```

This opt-in mode may use network/cache access for Expo Doctor / Expo dependency checks. It uses the repository-pinned Expo Doctor version (`1.20.4`), not `latest`. Record its output separately.

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

1. Review host/toolchain drift and exact `main`/worktree provenance.
2. Review physical `node_modules` resolution, including MMKV v4/Nitro and the explicit Babel/Expo runtime dependencies.
3. Run frozen root install and capture a second report.
4. Review the pinned Expo Doctor / dependency compatibility results.
5. Verify the normalized single `mobile/eas.json` authority.
6. Generate/inspect native config.
7. Prove clean Metro bundle from `mobile/`.
8. Prove exact emulator/dev-client connection and artifact/SHA identity.
9. Prove force-stop/relaunch storage persistence and locked/background GPS durability.
10. Execute the mandatory Ride smoke: Start -> Active -> Pause -> Resume -> Finish -> Summary -> Home.
11. Only then resume visual review.

Do not skip directly to UI.
