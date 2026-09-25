# Mobile — Android native toolchain (T83 isolated CMake/Ninja override)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-09-24 |
| **Audience** | Mobile Lead, Platform Operator (env), QA |
| **Related** | [MOBILE.md](./MOBILE.md), [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) |
| **Script** | `scripts/android/ninja-bootstrap.ps1` |
| **Test** | `scripts/test_android_ninja_bootstrap.py` |

> **Scope:** This document describes the workaround for a confirmed failure
> in **our Windows Android native toolchain** during the T83 spike. It does
> NOT make a global claim about Ninja 1.10.2 on every other system — we only
> describe what we observed and how we reproduce and avoid it.

---

## TL;DR for the impatient

```powershell
# From the monorepo root.
pwsh -File scripts/android/ninja-bootstrap.ps1 -ConfigureGradle
```

That single command prepares a per-user, idempotent toolchain at
`%LOCALAPPDATA%\4velo\android-toolchain\cmake-3.22.1-ninja-1.12.1\` and
records it in `mobile/android/local.properties` under the `cmake.dir=` key —
**without touching the Android SDK, the global CMake install, or `PATH`**.

To undo it: `Remove-Item -Recurse -Force "$env:LOCALAPPDATA\4velo\android-toolchain"`.

---

## Why this script exists (T83 backstory)

The T83 spike pinned a reproducible Windows-only build failure that affected
React Native's Android native compile step. The exact symptom, observed
verbatim in Gradle/CMake output:

```
manifest 'build.ninja' still dirty after 100 tries
```

The failure appeared during `react-native-nitro-modules:buildCMakeDebug`
and the subsequent `:app:assembleDebug` task. CMake kept treating its own
regenerated `build.ninja` as "dirty" and refused to start the build,
returning the same error on every regeneration attempt.

### What T83 confirmed

| Configuration | CMake | Ninja | `buildCMakeDebug[x86_64]` | `assembleDebug -PreactNativeArchitectures=x86_64` | APK produced |
|---|---|---|---|---|---|
| Android SDK stock | 3.22.1 (bit-identical) | 1.10.2 (bundled) | **FAIL** (`manifest 'build.ninja' still dirty after 100 tries`) | **FAIL** | ❌ |
| T83 experiment | 3.22.1 (same SDK tree) | **1.12.1** dropped in place of 1.10.2 | **PASS** | **PASS** | ✅ |

- The T83 repro proved the failure is **specific to the Ninja 1.10.2 binary
  shipped inside `%ANDROID_HOME%\cmake\3.22.1\bin\` on our Windows
  configuration** — not to a CMake bug, not to a project issue, not to PATH
  pollution, and not to long-path settings (`LongPathsEnabled=1`, max
  absolute normalized path in tree = 251, zero paths > 259).
- Replacing only `ninja.exe` with the official v1.12.1 binary from
  `https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip`
  makes the same Android SDK installation build the project cleanly. The bug
  notes for Ninja 1.12.1 (`Screen updates extremely slow on Windows #2435`,
  `Dry run error if the build directory does not exist #2431`) back this up
  without attributing it to a 1.10.2-→-1.12.1 incompatibility.
- Per the task brief: the experimental directory
  `D:\t83-tools\cmake-3.22.1-ninja-1.12.1` is **evidence**, not the product.
  The real product is the script described below.

### Why we do not patch the Android SDK globally

We deliberately do NOT replace files under `%ANDROID_HOME%\cmake\3.22.1\bin\`
or `%ANDROID_SDK_ROOT%\cmake\3.22.1\bin\`. The script stages a copy of the
SDK's CMake tree under `%LOCALAPPDATA%\4velo\android-toolchain\...`, drops
Ninja 1.12.1 there, and points Gradle at that copy via `cmake.dir=` in
`mobile/android/local.properties`. This keeps:

- The Android SDK package manager (`sdkmanager`) state pristine.
- Other tools that depend on the SDK's bundled Ninja (e.g. other RN
  projects, ad-hoc Gradle experiments) unaffected.
- The override entirely *opt-in per developer* and reversible with
  `Remove-Item`.

---

## How the bootstrap works

```
$LOCALAPPDATA/4velo/android-toolchain/cmake-3.22.1-ninja-1.12.1/
├── bin/                ← robocopy mirror of %ANDROID_HOME%/cmake/3.22.1/bin
│   ├── cmake.exe       (3.22.1, bit-identical to SDK)
│   └── ninja.exe       (1.12.1, downloaded, SHA256-verified)
├── share/              (CMake modules — full SDK/CMake/Android tree)
├── doc/                (CMake docs)
└── 4velo-managed.txt   (marker; tells humans and tools this tree is managed)
```

| Step | Behaviour | Idempotent? |
|---|---|---|
| Resolve SDK root | Tries `-SdkRoot`, `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `%LOCALAPPDATA%\Android\Sdk`. Errors out if SDK `cmake\3.22.1\bin\cmake.exe` is missing. | n/a |
| Stage toolchain tree | `robocopy /MIR` of the SDK's `cmake\3.22.1` tree into the isolated root, deleting the bundled `ninja.exe`. Skipped on subsequent runs (marker file present). | ✅ |
| Obtain pinned Ninja 1.12.1 | Downloads `ninja-win.zip` from the official `v1.12.1` GitHub release; verifies the ZIP SHA256 (`F550…467A`) and the extracted `ninja.exe` SHA256 (`6886…29B8`). Accepts `-NinjaExe` or `%USERPROFILE%\Downloads\ninja.exe` pre-staged binaries offline. | ✅ |
| Configure Gradle (optional) | Adds or replaces a single `cmake.dir=<isolated-toolchain>` line in `mobile/android/local.properties`, preserving every other line (`sdk.dir`, `ndk.dir`, `reactNativeArchitectures`, …) verbatim. Re-runs are byte-for-byte stable. | ✅ |

Failure modes are **fail-closed**:

- Non-Windows host → script refuses to run.
- Android SDK CMake 3.22.1 missing → script refuses to guess.
- Downloaded zip SHA256 mismatch → script refuses to extract.
- Extracted `ninja.exe` SHA256 mismatch → script refuses to use it.
- Ninja reported version `< 1.12.0` after install → script refuses the
  final toolchain.

To override the SHA256 gate for offline smoke-tests you must pass
`-SkipHashCheck` *and* trust the binary you supplied yourself. There is no
secret knob that turns hash verification off by default.

---

## Prerequisites (documented)

| Requirement | Why |
|---|---|
| Windows (PowerShell 5.1 or `pwsh` 7+) | The Android SDK problem surfaces on Windows. The script fail-closes on other OSes. |
| Android SDK with `cmake\3.22.1\bin\cmake.exe` already installed | The bootstrap copies that tree; it does not download CMake. |
| Default location or `ANDROID_SDK_ROOT` / `ANDROID_HOME` set | Discovery order is documented in the script and in the error message if discovery fails. |
| Outbound HTTPS to `github.com` | Default Ninja acquisition. If your machine is offline, pre-stage `ninja.exe` (SHA256 `6886…29B8`) at `%USERPROFILE%\Downloads\ninja.exe` or pass `-NinjaExe`. |
| PowerShell 7+ recommended for Linux/macOS contract validation | The `-SelfTest` mode is platform-agnostic; only `-ConfigureGradle` and the actual Gradle build require Windows + Android SDK. |

The script does **not** assume that `D:\t83-tools\...` exists, nor any
Visual Studio installation. It does **not** require a specific Java
version; the Gradle side already pins `java 17`.

---

## Run it

```powershell
# 1. Standard run on a fresh machine. Prepares the isolated toolchain and
#    writes cmake.dir= into mobile/android/local.properties.
pwsh -File scripts/android/ninja-bootstrap.ps1 -ConfigureGradle

# 2. Re-run any time — the operation is idempotent. Existing local.properties
#    entries (sdk.dir, ndk.dir, reactNativeArchitectures, …) are preserved.
pwsh -File scripts/android/ninja-bootstrap.ps1 -ConfigureGradle

# 3. Repopulate the isolated toolchain even if it already exists.
pwsh -File scripts/android/ninja-bootstrap.ps1 -Force -ConfigureGradle

# 4. Use a pre-staged ninja.exe on a machine without GitHub access.
pwsh -File scripts/android/ninja-bootstrap.ps1 -NinjaExe C:\path\to\ninja.exe -ConfigureGradle

# 5. CI / pre-flight contract check (does not require an Android SDK).
pwsh -File scripts/android/ninja-bootstrap.ps1 -SelfTest

# 6. Print what would happen, in red/yellow, then stop before writing disk.
pwsh -File scripts/android/ninja-bootstrap.ps1 -WhatIf  # PowerShell WhatIf via the script parameters is -Quiet
```

The `-ConfigureGradle` switch is opt-in: skipping it leaves
`mobile/android/local.properties` untouched.

---

## Uninstall / rollback

```powershell
# 1. Tear down the isolated toolchain.
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\4velo\android-toolchain\cmake-3.22.1-ninja-1.12.1"

# 2. Drop the cmake.dir= line we added to mobile/android/local.properties.
#    The PowerShell helper rewrites the file; you can hand-edit it back to
#    nothing, or simply run another bootstrap that points cmake.dir= at a
#    different toolchain later.
```

Reinstalling the Android SDK is unnecessary — the script never touches it.

---

## Verifying Gradle picked up the override

After running `-ConfigureGradle`, the `:app:externalNativeBuild...` Gradle
task must show our `ninja.exe` in the configure step. Look for:

```
-- The C compiler identification is ...
-- The CXX compiler identification is ...
-- Check for working C compiler: ...
-- Check for working CXX compiler: ...
-- Configuring done
-- Generating done
-- Build files have been written to: <isolated-toolchain-path>/.cxx/...
-- The CMAKE_C_COMPILER: ...
-- The CMAKE_CXX_COMPILER: ...
-- The CMAKE_MAKE_PROGRAM: <isolated-toolchain-path>/bin/ninja.exe
```

If `CMAKE_MAKE_PROGRAM` is the SDK's `ninja.exe`, the override did not take
effect. Re-run the bootstrap with `-Verbose` (and `pwsh -NoProfile -File ... -Force`)
until you see the marker file being repopulated.

---

## Contract test

The script's invariants are pinned by a Python unit test at
`scripts/test_android_ninja_bootstrap.py`. The test is invoked from
`.github/workflows/mobile-native-smoke.yml` on every PR and:

1. Asserts the pinned URL and the two SHA256 hashes are still inside the
   bootstrap (catches accidental drift).
2. Re-implements `Set-CmakeDirInLocalProperties` in Python and drives it on
   a temporary `local.properties` to prove the helper is idempotent and
   preserves unrelated keys.
3. Asserts the version-gate logic still rejects Ninja `1.10.x` and `1.11.x`
   and accepts `1.12.1+`.
4. When `pwsh` is available on the runner, also spawns the bootstrap's
   own `-SelfTest` mode end-to-end.

Run it locally with:

```bash
python -m unittest scripts/test_android_ninja_bootstrap.py -v
```

---

## FAQ

**Does this apply to macOS or Linux Android builds?**  No. The T83
observation only confirmed the failure on the **Windows** Android native
toolchain that ships `cmake\3.22.1\bin\ninja.exe` (1.10.2). On macOS and
Linux the Android SDK does not pre-stage a Ninja binary in the SDK tree, so
CMake resolves Ninja from the system PATH (or AGP's own detection), and
the T83 symptom did not appear. The bootstrap is Windows-only and fails
closed on other hosts.

**Do I still need the Android SDK's CMake 3.22.1 install?**  Yes. The
bootstrap copies that tree into the isolated root and would have no way to
obtain CMake 3.22.1 otherwise.

**Can I use a newer CMake than 3.22.1?**  Not without re-testing every
React Native Android native module — the project pins CMake 3.22.1 because
that is the version AGP expects for this AGP/Gradle combo.

**Will this conflict with Expo prebuild's regeneration of `mobile/android/`?**
No. `mobile/android/local.properties` is `.gitignore`-d but is also
re-materialised by `expo prebuild` and by Gradle's first run. The bootstrap
is idempotent and safe to re-run after every prebuild.

---

## Hygiene rules (operational)

- Never commit `ninja.exe`, `ninja-win.zip`, or any other downloaded
  artifact. The bootstrap always acquires the binary at runtime; the
  contract test only checks the pinned URL + SHA256 stay verbatim.
- Never edit `%ANDROID_HOME%\cmake\3.22.1\bin\`. Future re-installs via
  `sdkmanager` would silently restore Ninja 1.10.2 and the override would
  keep working.
- Treat the `4velo-managed.txt` marker inside
  `%LOCALAPPDATA%\4velo\android-toolchain\cmake-3.22.1-ninja-1.12.1\` as the
  authoritative "managed by 4velo" signal. Do not introduce other tools
  inside that directory.
