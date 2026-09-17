# T76 — physical Android / home-lab chaos and restart matrix

Status: **repo-side preparation complete; physical evidence still required**.

T76 is not a unit-test tranche. Its final acceptance requires an actual Android device
running the exact pilot build against the local home lab. Repository tests can prepare
the fault-injection procedure and fail-closed evidence format, but they cannot honestly
replace screen-off/background behavior, Android process death, USB/ADB transport, or
real restart timing.

## Contract

Every scenario below must demonstrate both sides of the invariant:

1. **device observation** — the app exposes pending/recovery state truthfully and does
   not silently discard locally durable GPS/session intent;
2. **server observation** — after recovery there is one canonical business effect:
   no duplicate activity, reward/spend/finalization, or telemetry effect caused by retry.

A successful shell command is not evidence. **scripts/t76_chaos.py** therefore refuses to
record PASS unless the operator explicitly confirms both device and server observations.

The generated evidence file lives under **backups/home-lab/evidence/**, which is ignored by
Git. It records a hash of the ADB serial rather than the raw serial and must never contain
passwords, tokens, signing keys, backup keys, or other secret values.

## Preconditions

Use the **exact candidate SHA** to build/install the Android pilot app. Before the matrix:

- python scripts/home_lab.py init has already created .env.home;
- python scripts/home_lab.py up is healthy;
- the pilot app package com.sport.athlete is installed on one authorized physical device;
- USB debugging is enabled and adb devices reports the device as device;
- the pilot account can start and finish an activity;
- the pilot home lab still has TELEMETRY_INGEST_QUEUE=0, so durable ACK is the direct-DB
  contract from T62 rather than Redis queue admission;
- use pilot/synthetic data only.

Do not run T76 against a production database.

## Start the evidence session

From the repository root:

~~~bash
python scripts/t76_chaos.py preflight
~~~

If more than one ADB device is attached:

~~~bash
python scripts/t76_chaos.py preflight --serial <adb-serial>
~~~

Preflight verifies the installed package, creates these USB reverse mappings and checks
the home lab:

~~~text
tcp:8000 -> tcp:8000   Django API
tcp:8001 -> tcp:8001   telemetry
tcp:8081 -> tcp:8081   Metro/dev-client path when used
~~~

It prints the path of the new evidence JSON. Keep using that same file for the entire run.

## Required physical matrix

| ID | Fault / action | Required observation before PASS |
| --- | --- | --- |
| T76-01 | Start a ride online. Let GPS stabilize, turn the screen off/lock the phone for a meaningful movement interval, then unlock. python scripts/t76_chaos.py screen-off may send the power key event, but physically confirm the screen is locked. | Ride/recovery state remains truthful; GPS gathered while locked is not silently lost; after sync the server has one activity and the canonical route/telemetry includes the locked interval. |
| T76-02 | During a ride disable phone network manually (airplane mode or both mobile data/Wi-Fi), continue moving, then reconnect. | App shows pending/offline state; pending GPS eventually drains after reconnect; server data contains the recovered interval with no duplicate activity/business effect. |
| T76-03 | While still offline with pending GPS, run python scripts/t76_chaos.py force-stop, relaunch the app while still offline, then reconnect. | Relaunch exposes recovery/pending state instead of false success; queued GPS survives process death; recovery finishes to one canonical activity. |
| T76-04 | Exercise an ambiguous activity create/finalize boundary. Immediately around start and again around stop/finalize run python scripts/t76_chaos.py restart-service --service backend. | Lost/ambiguous response is recovered by the durable request intent; retry produces one Activity; finalization is not shown durable until server acceptance and remains one finalization. |
| T76-05 | While telemetry is actively uploading, run python scripts/t76_chaos.py restart-service --service telemetry. Continue the ride and allow retry after service health returns. | Client retains unsent work while telemetry is unavailable; the same batch/retry resolves to one durable receipt/business effect; no silent point loss. |
| T76-06 | During active telemetry run python scripts/t76_chaos.py restart-service --service redis. | Pilot direct-DB ACK remains the durability boundary; temporary Redis loss must not turn an uncommitted batch into acknowledged durable data; after recovery there is no duplicate effect. |
| T76-07 | During an active ride with points waiting to upload run python scripts/t76_chaos.py restart-service --service db. | Client preserves pending work through database unavailability; after DB/home-lab recovery the queue drains and final activity is canonical, with no duplicate activity or critical effect. |
| T76-08 | Combined worst-case: go offline with pending GPS, force-stop the app, inject a backend or telemetry restart, relaunch offline, then restore services/network and finish the ride. | Recovery survives both mobile and server interruption; pending state reaches zero only after durable acceptance; exactly one final canonical activity remains. |

The operator may repeat a scenario if timing did not actually create the intended fault.
A scenario that was not meaningfully exercised is BLOCKED/NOT_RUN, not PASS.

## Server-side observation

For each scenario, verify the resulting activity using the pilot history/admin path and,
when ambiguity matters, database evidence from the isolated home lab. At minimum confirm:

- exactly one activity represents the user intent;
- the activity has the expected finalization state;
- recovered route/GPS covers the fault interval;
- telemetry retries did not create duplicate durable receipt/business effects;
- reward/voucher/finalization effects are not duplicated;
- the UI did not declare durable success while required data was still pending.

Do not copy authentication tokens or secret environment values into the evidence note.
Activity IDs, batch IDs, counts, timestamps and non-secret hashes are acceptable evidence.

## Record each result

Example:

~~~bash
python scripts/t76_chaos.py record backups/home-lab/evidence/t76-chaos-YYYYMMDD-HHMMSS.json \
  --scenario T76-02 \
  --result PASS \
  --device-observed \
  --server-observed \
  --note "Offline points stayed pending; after reconnect pending=0 and one activity contained recovered route interval."
~~~

If the physical action cannot be completed:

~~~bash
python scripts/t76_chaos.py record <evidence.json> \
  --scenario T76-02 --result BLOCKED \
  --note "Physical device unavailable."
~~~

If an invariant fails, record FAIL immediately and preserve the evidence instead of
retrying until the failure disappears.

## Fault helpers

The service helper accepts only the home-lab services relevant to the P3/T76 durability
audit:

~~~bash
python scripts/t76_chaos.py restart-service --service backend
python scripts/t76_chaos.py restart-service --service telemetry
python scripts/t76_chaos.py restart-service --service redis
python scripts/t76_chaos.py restart-service --service db
~~~

It restarts the selected Compose service and then requires the complete home lab to
return healthy. This helper injects the fault; it does **not** record a scenario as PASS.

## Finalize

After all eight physical scenarios:

~~~bash
python scripts/t76_chaos.py finalize <evidence.json>
~~~

The command fails closed when any scenario is NOT_RUN, BLOCKED or FAIL. Only eight
explicit PASS observations produce overall_status=PASS.

A completed JSON plus the exact candidate SHA and relevant non-secret server/device
observations is the T76 artifact to review. Until that exists, T76 remains incomplete.

## Scope boundary

This harness does not satisfy T57 (measured physical backup/restore RPO/RTO) and cannot
perform T68 (external signing-key rotation/revocation). Those remain separate external
evidence requirements. T76 also does not authorize moving to T79 by itself; the
data-safety exit is reached only when T57, T68 and T76 evidence are all accepted.
