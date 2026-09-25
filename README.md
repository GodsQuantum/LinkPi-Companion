<p align="center">
  <img src="docs/assets/logo.svg" width="132" alt="LinkPi Companion logo">
</p>

<h1 align="center">LinkPi Companion</h1>

<p align="center"><strong>Turn your LinkPi into a guided multicam recorder, streamer and automatic director.</strong></p>

<p align="center">
  Camera setup, recording checks, RTMP/RTMPS/SRT/RTP helpers and an audio-driven Auto Director — directly on the LinkPi, without replacing its native Encoder.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/device-LinkPi%20ENC1%20V3-18a7ff" alt="LinkPi ENC1 V3">
  <img src="https://img.shields.io/badge/UI-EN%20%7C%20FR%20%7C%20%E4%B8%AD%E6%96%87-9d78ff" alt="English French Chinese UI">
  <img src="https://img.shields.io/badge/stream-RTMP%20%7C%20SRT%20%7C%20RTP-63f2e9" alt="RTMP SRT RTP">
  <img src="https://img.shields.io/badge/license-MIT-3dd7cf" alt="MIT license">
  <a href="https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml"><img src="https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">🇫🇷 <a href="README.fr.md">Français</a> · 🇨🇳 <a href="README.zh-CN.md">简体中文</a></p>

---

<p align="center"><img src="docs/assets/screenshot-guide.png" width="920" alt="LinkPi Companion guided setup dashboard"></p>
<p align="center"><i>A six-step setup guide turns a dense encoder UI into a practical checklist.</i></p>

## Why LinkPi Companion?

A LinkPi can do a lot. The hard part is remembering **where everything lives**, which values belong in which streaming field, whether recording is actually ready, and whether your automatic switching logic is safe to arm.

LinkPi Companion puts that workflow on one page at `http://<LINKPI_IP>:8787`:

- **Studio** — a simple OBS-like surface for native LinkPi Stream/Stop, Record/Stop, source, quality, providers and Auto Director.
- **Guided setup** — cameras → video/audio → Auto Director → recording → streaming → preflight.
- **Direct native links** — Input, Encode, Stream, Push, Record, Storage, Carousel and Mix open the exact LinkPi page you need.
- **Streaming helpers** — build and validate RTMP/RTMPS, SRT and RTP/UDP values without storing stream keys.
- **Recording readiness** — check external storage, MP4 and the target CAM A + CAM B + PROGRAM workflow.
- **Auto Director** — audio-driven CAM A / CAM B / SPLIT decisions with minimum-shot, refractory and overlap protection.
- **Safe by default** — native C++ Encoder stays in charge; AUTO remains locked until readiness is proven.
- **Portable** — the Companion lives on the LinkPi, so the guide travels with the box.

<p align="center"><img src="docs/assets/screenshot-studio.png" width="920" alt="LinkPi Companion Studio simple native control room"></p>
<p align="center"><i>Studio turns native LinkPi controls into a simple source → quality → destination → Stream/Record workflow.</i></p>

<p align="center">
  <img src="docs/assets/screenshot-streaming.png" width="455" alt="LinkPi Companion SRT and streaming assistant">
  <img src="docs/assets/screenshot-autodirector.png" width="455" alt="LinkPi Companion Auto Director controls">
</p>

## Quick start

From any Linux/macOS machine on the same LAN:

```bash
git clone https://github.com/GodsQuantum/linkpi-companion.git
cd linkpi-companion
./scripts/install.sh <LINKPI_IP>
```

Then open:

```text
http://<LINKPI_IP>:8787
```

No SSH is required for the normal install path on the tested firmware: the installer uses LinkPi's native configuration-restore mechanism, preserves existing Companion calibration/settings and merges its watchdog into the existing cron.

Useful commands:

```bash
./scripts/status.sh <LINKPI_IP>
./scripts/harden.sh <LINKPI_IP>
./scripts/test.sh
```

> **Alpha status:** the software and safety gates are validated, but the final production workload still needs real-hardware commissioning for each setup. Do not assume three simultaneous MP4 recordings + live streaming are within your unit's resource budget until you test them.

## What the Guide walks through

1. **Cameras** — confirm HDMI and USB/UVC sources are actually present.
2. **Video + audio** — review readable channel summaries and sane starting values.
3. **Auto Director** — validate RPC, two sources, two audio meters, calibration and A/B/SPLIT scenes.
4. **Recording** — prepare external storage and MP4 recording.
5. **Streaming** — generate values for YouTube/Twitch/custom RTMP, SRT and RTP/UDP.
6. **Preflight** — get a workflow-aware READY / INCOMPLETE / PROBLEM result before going live.

The UI is available in **English, French and Simplified Chinese**, with the choice stored only in the browser. You can also link directly with `?lang=en`, `?lang=fr` or `?lang=zh-CN`.

## Studio: native LinkPi control without the menu maze

The **Guide** remains a safe assistant. The new **Studio** view can also apply explicit actions through the same native LinkPi RPCs used by the firmware UI.

- **Source** — Auto, HDMI, USB/UVC, Program/Mix or Net1–Net4.
- **Live quality** — 4K, 1080p, 720p, 360p and portrait variants; 24/25/30/50/60 fps where the source/device can support them.
- **Master vs live** — MAIN can stay a high-quality H.265 recording master while SUB carries a lower-bandwidth live stream.
- **Providers** — YouTube, Twitch, Restream and Remote OBS.
- **Transport controls** — Start/Stop Stream and Start/Stop Record from Companion.
- **Internet guest** — either pull RTSP/RTMP/SRT/UDP into Net1–Net4, or let Studio generate a native incoming SRT guest URL through LinkPi's built-in SLS server on UDP 8080.
- **Auto master capture** — on UVC cameras, `Auto / source max` selects the highest camera mode actually advertised at the chosen FPS; HDMI follows its input signal.
- **Auto Director pairing** — choose any two HDMI/USB/Net inputs as A/B, prepare the native scenes and calibrate silence/speech from Studio.
- **Auto Director** — OFF / DRY-RUN / AUTO remains safety-gated.

Provider strategy is destination-aware: YouTube direct can use RTMPS + HEVC/H.265; Twitch direct uses H.264 for the ordinary hardware RTMP path; Restream prefers SRT + HEVC on Business/Enterprise plans when the account provides SRT ingest (SRT caller compatibility must still be validated against the actual Restream endpoint on this ENC1 V3 firmware); Remote OBS uses SRT + H.265 by default with H.264 fallback; Direct mode runs the LinkPi as the validated SRT listener and gives the remote OBS a caller URL.

Provider credentials may be stored locally on the LinkPi in Companion's private `providers.json` (mode `0600`). GET APIs expose only configured/not-configured flags, never stream keys, SRT passphrases or private publish/read URLs.

A VDO.Ninja browser URL is WebRTC and cannot be decoded directly by this LinkPi firmware. Use a WebRTC/WHIP bridge such as MediaMTX and publish H.264 + AAC to the incoming SRT URL generated by Studio, or expose the guest as RTSP/SRT and use pull mode. The built-in SLS path is intended for H.264 MPEG-TS; use an external relay for encrypted/HEVC guest contribution.

## Recording target

The intended production workflow is:

```text
CAM A ─┐
CAM B ─┼─► PROGRAM ─► live stream
       │
       └─► CAM A + CAM B + PROGRAM → MP4 on external USB storage
```

For long recordings, a modern external drive is recommended. Native recordings are written under `/root/usb/` and exposed by the LinkPi file browser under `/files/`. The UI deliberately marks the three-recording target as unvalidated until it has been benchmarked on the actual LinkPi workload.

> **USB/UVC note:** 4K remains available, but on an ENC1 V3 USB link treat 1080p30 as the stability baseline until your camera/cable combination passes a sustained 4K soak test.

## Auto Director

The native LinkPi Encoder still owns capture, encode, record and stream. Companion only reads telemetry and uses native Carousel switching.

The **Natural** preset starts with 900 ms acquisition, 5 s minimum shot, 2.5 s refractory period, 1 s overlap before SPLIT, 3 s SPLIT hold and 7 s silence before neutral SPLIT. **Stable** and **Reactive** presets are included, and each setting has inline help.

Program audio is intentionally independent from video cuts: speaker activity drives editorial decisions while the final mix can keep both microphones continuously present.

## Tested target

Development and live validation have focused on:

- LinkPi ENC1 V3 / SS524V100
- APP/SDK 5.3.0, SYS 5.3.1 (20260731)
- native `/RPC`
- embedded PHP CLI at `/usr/php/bin/php`
- Companion runtime on port `8787`

Other firmware/model combinations may work, but should be treated as unverified until reported by users.

## Safety model

- Native C++ Encoder stays in charge; Developer Mode / EncoderJS stays disabled.
- Auto Director boots in `OFF`.
- `DRY_RUN` can decide but cannot switch video.
- `AUTO` is rejected server-side until readiness passes.
- Companion's LinkPi diagnostics are read-only.
- The Guide never auto-starts a push or recording.
- Stream keys/passphrases are never persisted by Companion.
- High-frequency state lives in `/tmp` to avoid needless eMMC writes.

Port `8787` currently has no application-level authentication. Keep LinkPi Companion on a trusted LAN/VLAN or behind an authenticated VPN/reverse proxy. Never expose LinkPi control/RPC/UI ports directly to the Internet.

## Repository layout

```text
companion/embedded/       PHP runtime + UI installed on the LinkPi
companion/reference-node/ deterministic reference implementation + tests
docs/assets/              logo, screenshots and social preview
scripts/                  install, hardening, status and validation
docs/                     architecture, operations and hardware commissioning
```

Key docs: [Architecture](docs/ARCHITECTURE.md) · [Operations](docs/OPERATIONS.md) · [Hardware commissioning](docs/HARDWARE-COMMISSIONING.md) · [Production readiness](docs/PRODUCTION-READINESS-CHECKLIST.md)

## Contributing

Bug reports and hardware compatibility feedback are especially useful. Include the LinkPi model, APP/SDK/SYS versions and a reproducible description — but **never paste stream keys, passwords or private configuration archives**.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [SUPPORT.md](SUPPORT.md).

If LinkPi Companion makes your encoder easier to use, **star the repository** — stars make it easier for other LinkPi owners to rediscover and discover related projects on GitHub.

## License

[MIT](LICENSE). LinkPi Companion is an independent community project and is not affiliated with or endorsed by LinkPi.
