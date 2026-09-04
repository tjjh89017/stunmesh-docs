---
id: openwrt
title: OpenWrt
sidebar_position: 6
---

# OpenWrt

stunmesh-go publishes a signed apk package feed for OpenWrt 25.12 and SNAPSHOT. On OpenWrt 24.10, which ships Go 1.23, use the installer script instead.

## Install from the package feed

On the router:

```sh
wget -O /etc/apk/keys/stunmesh.pem https://tjjh89017.github.io/stunmesh-openwrt/stunmesh.pem
. /etc/os-release
echo "https://tjjh89017.github.io/stunmesh-openwrt/openwrt-25.12/$OPENWRT_ARCH/packages.adb" \
  > /etc/apk/repositories.d/stunmesh.list
apk update
apk add stunmesh-go
vi /etc/stunmesh/config.yaml
service stunmesh enable
service stunmesh start
```

Replace `openwrt-25.12` with `SNAPSHOT` to track snapshot builds instead. The `stunmesh-go` package pulls in `kmod-wireguard` and `ca-bundle`, and is built with the `builtin_all` tag so the Cloudflare and OpenDHT storage plugins are included; the config lives at `/etc/stunmesh/config.yaml` and the init script at `/etc/init.d/stunmesh`. The same feed also ships `stunmesh-agent` and `stunmesh-provd` for the separate stunmesh-provisioner project — see [stunmesh-openwrt](https://github.com/tjjh89017/stunmesh-openwrt) for those.

## OpenWrt 24.10: installer script

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

### Environment overrides

| Variable | Effect |
|---|---|
| `STUNMESH_VERSION` | Install a specific release tag instead of the latest. |
| `STUNMESH_ARCH` | Skip architecture detection (e.g. `mipsle`). |
| `STUNMESH_NO_CA` | Set to `1` to install the plain binary instead of the `-ca` variant. |
| `STUNMESH_BIN_DIR` | Install directory for the binary (default `/usr/bin`). |
| `STUNMESH_PURGE` | Uninstall only: set to `1` to also delete `/etc/stunmesh`, including the live config. |

To uninstall:

```sh
wget -qO- https://raw.githubusercontent.com/tjjh89017/stunmesh-go/main/scripts/openwrt-install.sh | sh -s -- uninstall
```

This stops and removes the service and binary, and keeps `/etc/stunmesh` unless `STUNMESH_PURGE=1` is set.

By default the script fetches the `-ca` binary, since most OpenWrt images don't ship the `ca-bundle` package that outbound TLS (Cloudflare API, HTTPS OpenDHT proxy) needs. Set `STUNMESH_NO_CA=1` if the router already has `ca-bundle` installed and you'd rather use the smaller plain binary. Release builds include both little-endian (`mipsle`) and big-endian (`mips`) MIPS binaries, all built with soft-float.
