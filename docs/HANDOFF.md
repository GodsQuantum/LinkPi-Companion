# Handoff — LinkPi Companion

Last updated: 2026-09-14

## Current truth

LinkPi Companion and Auto Director no longer depend on an external control computer for production. The final runtime is a lightweight PHP service deployed inside the LinkPi and supervised by the LinkPi's existing `crond`.

Verified target during development:

- LinkPi ENC1 V3
- SoC: SS524V100
- APP: 5.3.0 build 20260731_3295
- SDK: 5.3.0 build 20260731_30196
- SYS: 5.3.1 build 20260731
- PHP CLI: `/usr/php/bin/php`
- native Encoder RPC: local HTTP `/RPC`
- LinkPi Companion UI: `http://<linkpi>:8787` (Guide / Auto Director / Status)
- UI languages: French / English / Simplified Chinese (`?lang=fr|en|zh-CN`)
- native-link map: `dashboard.php`, `input.php`, `encode.php`, `stream.php`, `push.php`, `record.php`, `storage.php`, `carousel.php`, `mix.php`
- deployed files: `/link/config/autodirector/`

Developer Mode / EncoderJS is deliberately not used. On this firmware it is an alternate JS Encoder mode, not a safe plug-in host beside the native C++ Encoder.

## What is complete

- LinkPi Companion shell with beginner Guide, **Studio**, Auto Director and Status views;
- Studio native control for source selection, MAIN/SUB quality, Stream/Stop and Record/Stop;
- YouTube, Twitch, Restream SRT/HEVC and Remote OBS SRT providers with write-only secrets;
- Net1–Net4 Internet guest configuration for RTSP/RTMP/SRT/UDP sources;
- six-step commissioning flow from camera detection to preflight;
- sanitized diagnostics for channels, storage/recording and streaming destinations;
- RTMP/RTMPS, SRT and RTP/UDP value generators with validation/copy;
- workflow-aware READY / INCOMPLETE / PROBLEM preflight;
- exact native LinkPi PHP deep-links instead of generic dashboard links;
- multilingual FR/EN/zh-CN UI with browser-local language preference;

- deterministic A/B/SPLIT editorial state machine;
- presets Stable / Natural / Reactive;
- editable acquisition, minimum-shot, refractory, overlap, split-hold, silence, speech thresholds and dominance margin;
- integrated UI guide explaining every field;
- native LinkPi RPC telemetry from `enc.getVolume`, `enc.getInputState`, `enc.getSysState`, `carousel.getState`;
- OFF / DRY_RUN / AUTO / SAFE_SPLIT / MANUAL safety model;
- server-side AUTO readiness lock;
- embedded watchdog and boot persistence;
- 32-bit PHP-safe millisecond timing;
- install/recovery script that preserves existing calibration and cron jobs.

## Verified pre-hardware behavior

With no cameras or microphones connected, the embedded service reports RPC healthy while `videoReady`, `detectorsReady`, `calibrationReady`, `scenesReady` and therefore `autoReady` remain false. An attempt to arm AUTO is rejected with HTTP 409. This is expected and required.

The embedded PHP test suite has passed directly on the SS524 target, including:

- settings validation;
- editorial core behavior;
- local RPC and settings persistence;
- synthetic readiness;
- large epoch-millisecond timestamps on 32-bit PHP.

The reference Node implementation includes deterministic unit/API/UI tests covering the director, Companion diagnostics, wizard, streaming builders and safety boundaries.

## Appliance hardening state

On the development unit, persistent service configuration has been set to Telnet/ONVIF/NDI/SLS off, SSH/PHP/nginx/crond on, FRP/trans off, and NTP `fr.pool.ntp.org` with Europe/Paris retained. The firmware writes these settings immediately, but already-running daemons may remain listening until the next normal reboot. `scripts/harden.sh` reproduces this policy after a factory reset or firmware recovery and intentionally does not trigger a reboot.

Direct native RPC ports `6001–6004`, RTSP/RTMP, `8081`, and the legacy debug nginx on `8888` were observed on the LAN during audit. They are documented but not firewall-blocked in v1 because production camera/streaming dependencies have not yet been validated with real hardware.

## What is intentionally deferred

Do not guess these until the real capture chain is attached:

- negotiated Blackmagic HDMI format;
- DJI Osmo Pocket 3 UVC/UAC behavior;
- real microphone detector channel/side mapping;
- noise floor and speech-reference calibration;
- final A/B/SPLIT native layout IDs and split geometry;
- program MixA source routing and downmix choice;
- A/V sync offsets;
- production bitrate/frame rate;
- simultaneous ISO A + ISO B + Program recording load;
- YouTube/Twitch streaming profile.

The next phase is documented in `HARDWARE-COMMISSIONING.md`.

## Historical material

Earlier design/implementation artifacts are preserved locally under `local-private/work-history/` and are intentionally excluded from Git. `HANDOFF.md` and `ARCHITECTURE.md` are the authoritative current documents.
