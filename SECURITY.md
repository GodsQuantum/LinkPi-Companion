# Security Policy

## Supported versions

LinkPi Companion is currently an alpha project. Security fixes target the latest release on the `main` branch and the latest tagged alpha release.

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability, credential leak, authentication bypass or unsafe device-control path.

Use GitHub's **Report a vulnerability** / private vulnerability reporting flow from the repository Security tab. Include:

- affected LinkPi Companion version;
- affected LinkPi model/firmware when relevant;
- minimal reproduction steps;
- expected vs actual behavior;
- impact and any known workaround.

Do not include real stream keys, passwords, private configuration archives or other users' data.

## Security boundary

Port `8787` is intended for a trusted LAN/VLAN and currently has no application-level authentication. Never expose LinkPi Companion, the LinkPi native UI or direct RPC/control ports to the public Internet. Use an authenticated VPN for remote access.
