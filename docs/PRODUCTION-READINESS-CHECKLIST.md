# Production readiness checklist

The repository may be public while this checklist is incomplete. Until every applicable item passes on real hardware, releases must stay clearly marked **alpha / pre-production**.

## Hardware commissioning

- Blackmagic HDMI input is detected reliably at the chosen production format.
- DJI Osmo Pocket 3 UVC/UAC reconnects cleanly after unplug/replug.
- Mic A and Mic B are independently observable in `enc.getVolume()`.
- Noise-floor and speech-reference calibration is repeatable.
- CAM_A, CAM_B and SPLIT native layouts are validated with real framing.
- Program `MixA` contains both speakers continuously through every video cut.
- A/V sync is measured from recordings, not guessed.

## Recording and streaming

- External USB storage is detected after cold boot and reconnect.
- MP4 recording survives normal stop/start cycles.
- ISO A + ISO B + Program simultaneous recording is benchmarked on the SS524 resource budget.
- RTMP/RTMPS delivery is validated with at least one real platform.
- SRT caller/listener behavior is tested on the intended network path.
- RTP/UDP unicast or multicast is tested if used in production.

## Auto Director validation

- DRY_RUN behaves correctly through normal dialogue, interruptions, laughter and silence.
- AUTO completes a 30-minute conversational test without rapid A/B oscillation.
- Source disconnect/reconnect triggers the expected fail-safe behavior.
- Extended soak testing completes without Encoder reload, recording reset or runaway memory/CPU.

## Appliance hardening

- Run `./scripts/harden.sh <LINKPI_IP>` on a freshly restored device.
- Reboot normally and verify Telnet port 23 is closed.
- Confirm ONVIF/NDI/SLS stay disabled unless the workflow explicitly needs them.
- Re-audit direct RPC/debug ports after production tests before deciding whether to firewall them.

## Release hygiene

- `./scripts/test.sh` passes.
- Public-tree scans find no credentials, personal paths, device-specific IPs or hardware mappings.
- `local-private/`, `backups/`, device-specific `hardware.json` and generated archives remain ignored.
- README files and release notes clearly state the current validation level.
- A public release must never include the archived private development history.
