# Architecture

## Product surface

Port `8787` now exposes **LinkPi Companion**. Its default Guide is a beginner-facing commissioning wizard; the same single-page app also contains Auto Director and Status views plus a link to the native LinkPi UI. Companion diagnostics are read-only and sanitize credential-shaped values before they reach the browser.


## Runtime topology

```text
Mic A/B telemetry ──► native Encoder `/RPC` ──► Auto Director worker
                                              │
                                              ├─ decision state machine
                                              ├─ readiness / fail-safe gates
                                              └─ native Carousel scene requests

Browser ──► :8787 LinkPi Companion/router/API ──► state/settings/control files in /tmp + /link/config

Program audio ─────────────────► native MixA, independent from scene selection
Program video ─────────────────► native MixV / Carousel A-B-SPLIT layouts
```

The production daemon is PHP because the tested firmware already ships `/usr/php/bin/php`. This avoids adding Node, Python, containers or another package manager to the encoder appliance.

## Processes

`watchdog.sh` is invoked once per minute by the existing root `crond`. It ensures exactly two long-running processes exist:

1. `worker.php`: 10 Hz fast telemetry/decision loop, ~1 Hz slow health/input/Carousel telemetry.
2. PHP built-in web server: `0.0.0.0:8787`, serving the static UI and `router.php` API.

A release `VERSION` file is compared with `/tmp/autodirector-version`. Updating VERSION causes the watchdog to restart only the Auto Director worker/web processes, not the LinkPi Encoder.

## Persistence

Persistent files live under `/link/config/autodirector/` so they survive normal reboots and participate in LinkPi's config-backup mechanism.

- `settings.json`: editorial tuning values; created when saved from UI.
- `hardware.json`: detector, calibration, video source and scene mapping.
- code/UI/VERSION: installed from this repository.

High-frequency runtime state is kept in `/tmp`; the 10 Hz loop does not write eMMC continuously.

## Safety boundary

Modes:

- `OFF`: no editorial decisions or scene mutations.
- `DRY_RUN`: telemetry and decisions run; video mutation is forbidden.
- `AUTO`: decisions can mutate scenes only while every readiness gate is true.
- `SAFE_SPLIT`: requests the validated split scene and suspends automatic cutting.
- `MANUAL`: telemetry continues while automatic cuts remain suspended.

`AUTO` requires all of the following simultaneously:

- RPC healthy;
- both configured detector meters observable;
- valid independent calibration for A and B;
- both configured video sources present;
- A, B and SPLIT scene mappings validated;
- scene-control health true.

Loss of readiness while AUTO is running demotes the director to a safe non-automatic state rather than queuing cuts for later.

## Editorial model

The director is intentionally slower than a videoconference active-speaker switcher. Default Natural timings are:

- speaker acquisition: 900 ms;
- minimum single-camera shot: 5000 ms;
- refractory period: 2500 ms;
- sustained overlap before split: 1000 ms;
- split hold: 3000 ms;
- silence before neutral split: 7000 ms;
- initial normalized speech thresholds: 0.35 / 0.35;
- dominance margin: 0.15.

Short backchannels and tiny interruptions should not steal the camera. Sustained crosstalk tends toward SPLIT. Long monologues remain on the speaker rather than manufacturing cuts merely for visual movement.

## Why Carousel

The native Carousel path changes MixV dynamically. Generic `ctrl.setLay*` paths can reload Encoder configuration and are therefore not used for live editorial cuts. Auto Director only enables Carousel scene mutation after dedicated scene IDs have been verified with real inputs.

## Companion diagnostics and Studio control

The embedded `companion.php` exposes sanitized read models through `/api/companion/summary`, `/channels`, `/recording` and `/streaming`. The streaming read model never returns native push paths and recursively redacts credential-shaped keys. Guide progress is browser-local and contains only the current step and completed-step identifiers.

`studio.php` is the explicit write/control layer. It uses the same native RPC methods as the LinkPi firmware UI (`enc.update`, `push.update/start/stop`, `rec.update/start/stop`) for source, MAIN/SUB quality, providers, recording and Net1–Net4 inputs. Provider credentials are stored only on the appliance in `providers.json` with mode `0600`; Studio GET state returns configured/not-configured flags rather than stream keys, SRT passphrases or private URLs. Studio does not replace the native Encoder.
