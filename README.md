# LinkPi Companion


[![CI](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml) [![CodeQL](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
**English** · [Français](README.fr.md) · [中文](README.zh-CN.md)

A portable companion UI and autonomous interview/podcast auto-director for LinkPi ENC1 V3-class encoders.

The goal is simple: plug cameras and storage into a LinkPi, open `http://<LINKPI_IP>:8787`, and get a beginner-friendly path from **“my cameras are connected”** to **“I can record and stream safely”** without replacing the native LinkPi Encoder.

## Languages

The Companion UI supports **English, French and Simplified Chinese**. Choose the language from the header, or share a direct link with `?lang=en`, `?lang=fr` or `?lang=zh-CN`.

## What you get on port 8787

**Guide** is the default view. It walks through six steps:

1. Cameras — live HDMI / USB-UVC detection.
2. Video + audio — readable channel summaries and recommended starting points.
3. Auto Director — readiness, microphone calibration, CAM A / CAM B / SPLIT.
4. Recording — external storage, MP4 and target CAM A + CAM B + PROGRAM workflow.
5. Streaming — RTMP/RTMPS, SRT and RTP/UDP helpers with validated copyable values.
6. Preflight — workflow-aware READY / INCOMPLETE / PROBLEM checklist.

The same UI also contains the full **Auto Director** controls and an **Status** view, plus a direct link to the native LinkPi web interface.

Advanced information stays collapsed by default. Guide progress stores only harmless step/completion state in the browser. Stream keys, passphrases and credentials are never persisted by Companion.

## Project status

**Alpha: pre-hardware software validation is complete; real camera/microphone commissioning is still pending.**

Validated development target:

- LinkPi ENC1 V3 / SS524V100
- APP/SDK 5.3.0, SYS 5.3.1 (20260731)
- embedded PHP CLI at `/usr/php/bin/php`
- native Encoder `/RPC`
- LinkPi Companion at `http://<LINKPI_IP>:8787`

`AUTO` remains server-side locked until both cameras, independent microphone telemetry, calibration and A/B/SPLIT scenes are validated.

## Quick install / recovery

From a computer on the same LAN:

```bash
git clone https://github.com/GodsQuantum/linkpi-companion.git
cd linkpi-companion
./scripts/install.sh <LINKPI_IP>
```

Typical factory-default example:

```bash
./scripts/install.sh 192.168.1.217
```

The tested firmware accepts the deployment through LinkPi's native configuration-restore endpoint, so SSH is not required. The installer backs up existing Companion/Auto Director state, preserves hardware/calibration mappings and editorial settings, merges its watchdog into the existing root cron, installs the embedded runtime and verifies port `8787`.

Useful commands:

```bash
./scripts/status.sh <LINKPI_IP>
./scripts/harden.sh <LINKPI_IP>
./scripts/test.sh
```

To deliberately reset hardware/calibration mappings:

```bash
RESET_HARDWARE=1 ./scripts/install.sh <LINKPI_IP>
```

## Streaming helper

The Guide does **not** automatically write production streaming settings yet. It generates and validates the exact values to copy into the native LinkPi UI, which keeps the first hardware commissioning reversible.

Supported helpers:

- RTMP and RTMPS: server + stream key → complete push URL.
- SRT: caller/listener/rendezvous, host, port, latency, optional passphrase and streamid.
- RTP / UDP: unicast or multicast destination, port, TTL and RTP header toggle.
- YouTube and Twitch focused forms plus generic RTMP/RTMPS.

Secrets stay in the current browser fields only. Companion's own diagnostic API also removes credential-shaped values and never returns native push URLs.

## Recording target

The production target is **CAM A + CAM B + PROGRAM recorded to MP4 on external USB storage while PROGRAM is streamed**.

The Companion deliberately labels this as unvalidated until the real ENC1 V3 is benchmarked with the actual Blackmagic/Pocket 3/microphone workload. For long recordings, use a modern external disk; NTFS is the practical default for large files. Fragmented recording should be considered for crash/power-loss resilience.

## Auto Director behavior

The native C++ Encoder remains responsible for capture, encoding, recording and streaming. A lightweight PHP worker reads native telemetry and uses native Carousel switching; it never enables Developer Mode / EncoderJS.

Default **Natural** behavior: 900 ms acquisition, 5 s minimum shot, 2.5 s refractory period, 1 s overlap before SPLIT, 3 s SPLIT hold and 7 s silence before neutral SPLIT. **Stable** and **Reactive** presets are included, and every field is individually editable with integrated help.

Program audio is intentionally independent from video cuts: the target design keeps both speakers continuously present in the final mix while microphone activity only drives editorial decisions.

## Safety model

- Native C++ Encoder stays in charge; Developer Mode / EncoderJS stays disabled.
- Boot mode is `OFF`.
- `DRY_RUN` can decide but cannot mutate video.
- `AUTO` is rejected until readiness passes.
- Companion's LinkPi diagnostics are read-only.
- The Streaming Guide never auto-starts a push or recording.
- No stream key or platform credential is stored by Companion.
- High-frequency state lives in `/tmp`, avoiding continuous eMMC writes.

## Repository layout

```text
companion/embedded/       PHP runtime + Companion UI deployed in the LinkPi
companion/reference-node/ deterministic reference implementation + tests
scripts/                     install, hardening, recovery, status and validation
docs/                        architecture, operation, guide design and commissioning
local-private/               local device snapshots/history; never committed
```

Key docs:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- [`docs/HARDWARE-COMMISSIONING.md`](docs/HARDWARE-COMMISSIONING.md)
- [`docs/HANDOFF.md`](docs/HANDOFF.md)
- [`docs/PRODUCTION-READINESS-CHECKLIST.md`](docs/PRODUCTION-READINESS-CHECKLIST.md)

## Production readiness

This public repository is an **alpha** until real hardware tests validate camera negotiation, isolated microphone metering, calibration, native A/B/SPLIT layouts, continuous MixA audio, CAM A + CAM B + PROGRAM recording, streaming, firmware-update recovery and an extended soak test. See the production-readiness checklist.

## Security note

Port `8787` currently has no application-level authentication. Keep the LinkPi and Companion on a trusted LAN/VLAN and never expose LinkPi control/RPC/UI ports directly to the Internet.
