---
id: openwrt
title: OpenWrt
sidebar_position: 6
---

# OpenWrt

stunmesh-go ships an installer script for OpenWrt routers. It detects the router's architecture, downloads the matching release binary, and installs a procd init script.

## Install

On the router:

```sh
wget -qO- https://raw.githubusercontent.com/tjjh89017/stunmesh-go/main/scripts/openwrt-install.sh | sh
```

`curl` works the same way if it's installed instead of `wget`:

```sh
curl -fsSL https://raw.githubusercontent.com/tjjh89017/stunmesh-go/main/scripts/openwrt-install.sh | sh
```

This installs the binary to `/usr/bin/stunmesh-go`, writes `/etc/init.d/stunmesh` (a procd service, not yet enabled), and drops a sample config at `/etc/stunmesh/config.yaml.example`. Copy it to `config.yaml`, edit it, then:

```sh
/etc/init.d/stunmesh enable
/etc/init.d/stunmesh start
```

## Environment overrides

| Variable | Effect |
|---|---|
| `STUNMESH_VERSION` | Install a specific release tag instead of the latest. |
| `STUNMESH_ARCH` | Skip architecture detection (e.g. `mipsle`). |
| `STUNMESH_NO_CA` | Set to `1` to install the plain binary instead of the `-ca` variant. |
| `STUNMESH_BIN_DIR` | Install directory for the binary (default `/usr/bin`). |
| `STUNMESH_PURGE` | Uninstall only: set to `1` to also delete `/etc/stunmesh`, including the live config. |

## The `-ca` release variant

By default the installer fetches the `-ca` binary, which embeds a Mozilla CA fallback bundle. Most OpenWrt images don't ship the `ca-bundle` package, so without it TLS to the GitHub releases API and to any HTTPS storage plugin (Cloudflare DNS, an OpenDHT proxy) would fail. Set `STUNMESH_NO_CA=1` if the router already has `ca-bundle`/`libustream-mbedtls` installed and you'd rather use the smaller plain binary.

## Uninstall

```sh
wget -qO- https://raw.githubusercontent.com/tjjh89017/stunmesh-go/main/scripts/openwrt-install.sh | sh -s -- uninstall
```

This stops and removes the service and binary, and keeps `/etc/stunmesh` unless `STUNMESH_PURGE=1` is set.

## MIPS notes

Release builds now include big-endian MIPS (`mips`) alongside the existing little-endian (`mipsle`) builds. The installer tells the two apart by probing an ELF header on the router, since `uname -m` reports plain `mips` for both. All MIPS builds default to soft-float.
