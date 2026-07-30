---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

## Install

**Download a release binary** from the [releases page](https://github.com/tjjh89017/stunmesh-go/releases) for your platform, or **use the container image**, published primarily to GitHub Container Registry:

```bash
docker pull ghcr.io/tjjh89017/stunmesh
```

The image is also mirrored to Docker Hub (`tjjh89017/stunmesh`) for now, but that mirror may be removed in the future — prefer `ghcr.io`.

Release tags (e.g. `v1.13.0`) are published alongside `latest`, which always points at the newest stable release — release candidates (`-rc*` tags) never move it.

To build from source instead, see [Building from Source](reference/build.md).

## Run

On Linux, macOS, and FreeBSD, stunmesh-go needs raw socket access, so run it as root (Windows differs — see the [Windows guide](guides/windows.md)):

```bash
sudo ./stunmesh-go
```

It expects an already-configured WireGuard interface (e.g. brought up with `wg-quick`) and a `config.yaml` describing the interface, its peers, and a storage plugin.

## Configuration file

Configuration is loaded from the first of these paths that exists (each directory is checked for `config.yaml`, then `config.yml`):

- `$STUNMESH_CONFIG_DIR/config.yaml`
- `/etc/stunmesh/config.yaml`
- `~/.stunmesh/config.yaml`
- `./config.yaml`

You can also point stunmesh-go at a specific file with `-c <file>` (aliases: `--config`), or at a directory with `--config-dir <dir>`. An explicitly given file or directory must exist — there is no fallback to the default search paths.

A minimal two-node setup using the built-in Cloudflare plugin:

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "PEER_B":
        public_key: "<PEER_B_PUBLIC_KEY_BASE64>"
        plugin: cf
stun:
  addresses: ["stun.l.google.com:19302"]
plugins:
  cf:
    type: builtin
    name: cloudflare
    zone: example.com
    token: "<CLOUDFLARE_API_TOKEN>"
    subdomain: wg
```

Run the same setup on the other node (with this node's public key), wait roughly two refresh intervals, and the tunnel comes up. Verify with `wg show` or by pinging the peer's tunnel address.

The full option reference lives in [Configuration](configuration/overview.md), and the storage backends in [Storage Plugins](plugins/overview.md).

## When stunmesh-go must be restarted

stunmesh-go reads the WireGuard device's state once at startup and keeps it for the life of the process. Restart it after any of the following, or it will keep acting on stale values — usually without any error, because a stale port or mark still looks perfectly valid:

| Change | Why a restart is needed |
|---|---|
| `wg-quick down` then `up`, or otherwise recreating the interface | If the WireGuard config does not pin `ListenPort`, the kernel picks a **new random port** every time. stunmesh-go would keep probing the old one and publish an endpoint nobody is listening on. |
| `wg set <dev> listen-port ...` | Same as above. |
| `wg set <dev> fwmark ...` | The probe socket keeps the old mark and stops matching the device's routing path. |
| Editing `config.yaml` | The config is read once at startup; there is no reload. |

Under systemd, tie the two units together so this is enforced rather than remembered:

```ini
# /etc/systemd/system/stunmesh-go.service
[Unit]
After=wg-quick@wg0.service
BindsTo=wg-quick@wg0.service
```

`After=` also keeps stunmesh-go from starting before the interface exists; `BindsTo=` restarts it whenever `wg-quick@wg0` is restarted.

## Next steps

- Configure [IPv6 or dual-stack discovery](configuration/protocols.md)
- Add [STUN server fallback](configuration/stun-servers.md)
- Enable [ping monitoring](configuration/ping-monitoring.md) for automatic recovery
- Follow a full walkthrough: [VyOS site-to-site](guides/vyos.md), [macOS behind LTE](guides/macos.md), or [Windows](guides/windows.md)
