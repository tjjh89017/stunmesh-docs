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

By default the installer fetches the `-ca` binary, which embeds a Mozilla CA fallback bundle for the binary's own outbound TLS (the Cloudflare API, an HTTPS OpenDHT proxy). Most OpenWrt images don't ship the `ca-bundle` package, so without the embedded bundle those HTTPS storage plugins would fail. Set `STUNMESH_NO_CA=1` if the router already has `ca-bundle` installed and you'd rather use the smaller plain binary.

## Uninstall

```sh
wget -qO- https://raw.githubusercontent.com/tjjh89017/stunmesh-go/main/scripts/openwrt-install.sh | sh -s -- uninstall
```

This stops and removes the service and binary, and keeps `/etc/stunmesh` unless `STUNMESH_PURGE=1` is set.

## MIPS notes

Release builds include both little-endian (`mipsle`) and big-endian (`mips`) MIPS binaries, all built with soft-float.
