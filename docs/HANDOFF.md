# Handoff — LinkPi Companion

Last updated: 2026-09-26
Current public release: **v0.4.0-alpha.2**

## Current truth

LinkPi Companion is a lightweight control and guidance layer that runs on the LinkPi itself while leaving the native C++ Encoder in charge. It is served at `http://<LINKPI_IP>:8787` and is supervised by the LinkPi's existing `crond`.

Verified development target:
- LinkPi ENC1 V3 / SS524V100;
- APP 5.3.0 build 20260731_3295;
- SDK 5.3.0 build 20260731_30196;
- SYS 5.3.1 build 20260731;
- PHP CLI `/usr/php/bin/php`;
- native Encoder RPC through `/RPC`;
- FR / EN / Simplified Chinese UI;
- deployed compatibility path `/link/config/autodirector/`.

Developer Mode / EncoderJS is deliberately not used. It is an alternate encoder path, not a safe extension point beside the native C++ Encoder.

## What is complete

- Beginner Guide, **Studio**, Auto Director and Status views.
- Exact native LinkPi deep-links for Input, Encode, Stream, Push, Record, Storage, Carousel and Mix.
- Native Studio control for source selection, MAIN/master and SUB/live quality, Stream/Stop and Record/Stop.
- H.264/H.265 profiles, LinkPi-native resolutions and practical frame rates with hardware guards.
- Destination-aware provider strategy for YouTube, Twitch, Restream and Remote OBS.
- Remote OBS Direct and Relay SRT workflows.
- Net1–Net4 Internet guest inputs plus native incoming SRT guest support through LinkPi's SLS path.
- External-storage mount flow, MP4 recording control and fragmentation.
- Studio-side Auto Director preparation and silence/speech calibration actions.
- Write-only provider credentials with sanitized GET state.
- Deterministic A/B/SPLIT editorial state machine with safety timing and readiness gates.
- Idempotent install/recovery that preserves Companion settings, Studio config, provider secrets and existing cron jobs.

## Verified hardware behavior

The DJI Osmo Pocket 3 USB/UVC path has been validated on the target firmware. The device is enumerated through native UVC/UAC, and Companion/Studio includes a firmware-quirk path that uses the real UVC modes advertised by the camera rather than blindly upscaling.

The public test suite covers the UVC path, Studio write boundaries, provider secret redaction, Remote OBS SRT direction, native SRT updates, incoming SRT guest handling, Auto Director controls, multilingual UI and native LinkPi deep-links.

At this release, the software safety and control paths are validated, but final production workload limits still depend on the attached cameras, microphones, storage and provider endpoints.

## Streaming strategy

- **YouTube direct:** RTMPS with HEVC/H.265 is available when desired.
- **Twitch direct:** ordinary hardware RTMP remains H.264 for compatibility.
- **Restream:** SRT + HEVC is the preferred bandwidth-efficient path when the account exposes SRT ingest; validate the account-specific endpoint before production use.
- **Remote OBS:** Direct mode uses the validated LinkPi-listener / OBS-caller SRT direction; Relay mode is available when neither end should require inbound NAT.
- **Internet guest:** LinkPi can use RTSP/RTMP/SRT/UDP network inputs. Browser WebRTC URLs such as VDO.Ninja require a WebRTC/WHIP bridge such as MediaMTX before they become a LinkPi-decodable SRT/RTSP source.

## What remains intentionally hardware-specific

Do not hard-code these without real commissioning:
- final Blackmagic HDMI negotiated format;
- microphone A/B transport and channel mapping;
- room-specific detector noise floor and speech references;
- final A/B/SPLIT framing and crop choices;
- A/V sync offsets;
- final provider bitrates under the real network uplink;
- external-disk sustained write performance;
- simultaneous camera ISO + Program MP4 recording load;
- provider-specific SRT behavior for the actual account endpoint.

The intended production target is still:

```text
CAM A ─┐
CAM B ─┼─► PROGRAM ─► live stream
       │
       └─► CAM A + CAM B + PROGRAM → MP4 on external USB storage
```

Do not call that workload production-ready until it has passed a real soak test.

## Release discipline

Before a release: run `./scripts/test.sh`, validate the target LinkPi live, scan the public tree for private data/secrets, keep the Git tree clean, push `main`, and verify CI/CodeQL. Environment-specific IPs, provider credentials and private hardware backups belong outside the public repository.
