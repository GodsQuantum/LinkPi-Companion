# Contributing to LinkPi Companion

Thanks for improving LinkPi Companion. The project targets small embedded LinkPi encoder appliances, so changes should favor **simplicity, reversibility and low resource use**.

## Before opening a change

- Read `README.md` and `docs/ARCHITECTURE.md`.
- Keep the native LinkPi C++ Encoder in charge of capture/encoding/recording/streaming.
- Do not require Developer Mode / EncoderJS for normal Companion use.
- Never commit stream keys, passwords, device backups, private IP mappings or personal paths.
- Keep production-changing actions conservative; read-only diagnostics are preferred until hardware behavior is proven.

## Development workflow

```bash
./scripts/test.sh
```

The test suite checks shell syntax, embedded/reference UI parity, the installer/hardening helpers and the Node reference tests.

For behavior changes, add or update a failing test first, then implement the smallest change that makes it pass.

## Pull requests

A useful PR should include:

- what problem it solves;
- tested LinkPi model / firmware when hardware-specific;
- whether it changes read-only diagnostics or production state;
- tests added or updated;
- screenshots for UI changes when practical;
- rollback/recovery notes for embedded changes.

Keep PRs focused. Avoid unrelated formatting or generated artifacts.

## Hardware reports

When reporting device behavior, include model, SoC/firmware versions, input type and a sanitized reproduction. Do **not** upload configuration archives containing credentials or stream URLs.

## Compatibility

The currently validated development target is the ENC1 V3 / SS524V100 firmware family documented in the README. Other models are welcome, but should be treated as unverified until tested.
