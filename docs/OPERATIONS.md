# Operations and recovery

## Install or reinstall

```bash
./scripts/install.sh <LINKPI_IP>
```

Example after a factory reset using the common LinkPi default address:

```bash
./scripts/install.sh 192.168.1.217
```

Example on a reserved LAN address:

```bash
./scripts/install.sh <IP_LINKPI>
```

The installer:

1. verifies the LinkPi HTTP endpoint is reachable;
2. downloads any existing Auto Director hardware/settings config and root cron into a timestamped local backup;
3. packages the tracked embedded runtime;
4. preserves existing `hardware.json` unless `RESET_HARDWARE=1` is explicitly set;
5. preserves existing editorial `settings.json` when present;
6. removes duplicate Auto Director cron lines and appends exactly one watchdog line;
7. uploads through `/link/upd/uploadConf.php`;
8. waits for `http://<LINKPI_IP>:8787/api/state` and prints health/readiness.

The local backup directory is gitignored.

## Check status

```bash
./scripts/status.sh <LINKPI_IP>
```

Open `http://<LINKPI_IP>:8787` for LinkPi Companion. The Guide is the default view; Auto Director and Status are available from the top navigation. The important production fields are RPC health and the five readiness gates. `autoReady=false` is expected until hardware commissioning is complete.

## Local development validation

```bash
./scripts/test.sh
```

This validates shell syntax, confirms the embedded and reference UI copies are identical, checks browser JS syntax and runs the deterministic Node test suite.

## Appliance hardening

Run after install/recovery:

```bash
./scripts/harden.sh <LINKPI_IP>
```

The script backs up current `service.json` and `ntp.json`, then applies the tested policy: Telnet/ONVIF/NDI/SLS off; SSH/PHP/nginx/crond on; FRP/trans off; NTP enabled with `fr.pool.ntp.org`. It never reboots automatically. A normal LinkPi reboot is required for daemons already running before the change to stop.

## Network security

Auto Director is a trusted-LAN control surface. Port `8787` has no application login in v1, and the tested LinkPi firmware also exposes its configuration-restore endpoint on the LAN. Do not port-forward LinkPi HTTP, RPC, Telnet/SSH, RTSP or Auto Director `8787` to the Internet. Prefer a trusted VLAN/LAN or a separately authenticated VPN for remote access.

## LinkPi Companion Guide

The Guide is intentionally non-destructive during pre-hardware commissioning. It reads sanitized LinkPi state, explains the native settings to use, generates RTMP/RTMPS/SRT/RTP values and links back to the native UI. It does not start recording/streaming or write production Push/Record settings. The final preflight adapts to the selected workflow (Auto Director, Recording, Streaming) so unused features do not block READY.
