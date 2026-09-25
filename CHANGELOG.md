# Changelog

All notable changes to LinkPi Companion are documented here.

The project follows semantic versioning where practical. Pre-1.0 releases may change interfaces while hardware commissioning is still evolving.

## [Unreleased]

- Real-camera and microphone commissioning.
- Native A/B/SPLIT scene validation.
- Triple MP4 + program-stream load benchmark.

## [0.4.0-alpha.1] - 2026-09-25

- Added **Studio**, a simple native control surface for source selection, live quality, recording quality, Stream/Stop and Record/Stop.
- Added MAIN/master vs SUB/live profiles with H.264/H.265 and destination-aware codec selection.
- Added YouTube, Twitch, Restream SRT/HEVC and Remote OBS SRT providers.
- Added Direct and Relay Remote OBS workflows with generated SRT caller/listener URLs.
- Added Net1–Net4 Internet guest configuration for RTSP/RTMP/SRT/UDP sources.
- Added external-disk mount/record controls and MP4 fragmentation.
- Added write-only provider credential handling with sanitized Studio state APIs.
- Added native LinkPi resolution/FPS validation and 4K30 safety limit.
- Added UVC max-source capture selection: Auto master chooses the highest real camera mode for the selected FPS instead of upscaling.
- Added Studio-side Auto Director A/B preparation and silence/speech calibration for HDMI, USB or Net1–Net4 pairs.
- Added full EN/FR/zh-CN Studio UI.

## [0.3.0-alpha.2] - 2026-09-15

- Added a dedicated LinkPi Companion logo to the embedded UI and public project.
- Reworked EN/FR/zh-CN READMEs around product value, quick start and discoverability.
- Added sanitized UI screenshots for Guide, Streaming and Auto Director.
- Added a 1280×640 social-preview asset for repository sharing.
- Expanded LinkPi/streaming/search terminology while keeping the alpha hardware limits explicit.

## [0.3.0-alpha.1] - 2026-09-14

- Renamed the public project to **LinkPi Companion**.
- Added French, English and Simplified Chinese UI with browser persistence and `?lang=` links.
- Added beginner six-step setup/record/stream guide.
- Added exact native LinkPi links for Input, Encode, Stream, Push, Record, Storage, Carousel and Mix.
- Added safe RTMP/RTMPS, SRT and RTP/UDP generators.
- Added read-only sanitized LinkPi diagnostics.
- Added Auto Director presets, field help, readiness gates and fail-safe behavior.
- Added idempotent install/recovery and appliance hardening scripts.
- Added public-project security, contribution, CI, CodeQL and Dependabot configuration.
