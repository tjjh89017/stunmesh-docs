---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

This page walks through building a WireGuard tunnel between two Linux hosts (node A and node B) that each sit behind NAT, with no public IP on either side. stunmesh-go discovers each node's real (STUN-derived) endpoint and publishes it into the OpenDHT distributed hash table, so the other node can find it and WireGuard can establish a direct tunnel.

Prerequisites:

- Root access on both nodes.
- `wireguard-tools` installed on both nodes.
- Network access to at least one OpenDHT proxy endpoint (e.g. `https://dhtproxy2.jami.net`) — no account, token, or quota needed.

## Install stunmesh-go

**Download a release binary** from the [releases page](https://github.com/tjjh89017/stunmesh-go/releases) for your platform, or **use the container image**, published primarily to GitHub Container Registry:

```bash
docker pull ghcr.io/tjjh89017/stunmesh
```

The Docker Hub mirror (`tjjh89017/stunmesh`) is deprecated and will be **deleted** in the future — pulls from Docker Hub will stop working entirely. Use `ghcr.io` only.

Release tags (e.g. `v1.15.0`) are published alongside `latest`, which always points at the newest stable release — release candidates (`-rc*` tags) never move it.

On OpenWrt, install from the package feed — see the [OpenWrt guide](guides/openwrt.md).

To build from source instead, see [Building from Source](reference/build.md).

On Android, use the separate [stunmesh-android](https://github.com/tjjh89017/stunmesh-android) app and sideload the universal APK from its [releases page](https://github.com/tjjh89017/stunmesh-android/releases); the rest of this page covers the desktop/server binary.

## Set up WireGuard

stunmesh-go does not create the WireGuard interface itself — it manages the endpoint of an interface you already brought up. Set that up first with `wg-quick`.

Install `wireguard-tools` on both node A and node B (e.g. `apt install wireguard-tools` on Debian/Ubuntu). Then, on each node, generate a key pair:

```bash
wg genkey | tee privatekey | wg pubkey > publickey
```

This writes the private key to `privatekey` and the public key to `publickey`. Do this on both nodes — you'll need each node's public key in the other node's config.

### Node A: `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = <NODE_A_PRIVATE_KEY>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <NODE_B_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25
```

### Node B: `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = <NODE_B_PRIVATE_KEY>
Address = 10.0.0.2/24
ListenPort = 51820

[Peer]
PublicKey = <NODE_A_PUBLIC_KEY>
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

Two details matter here:

- **Pin `ListenPort` explicitly.** stunmesh-go reads the interface's listening port once at startup. If you leave `ListenPort` unset, the kernel picks a new random port every time the interface comes up, and stunmesh-go would keep probing and publishing a stale one.
- **Do not set `Endpoint` in the `[Peer]` section.** Neither node has a stable, reachable address yet — that's the problem stunmesh-go solves. It discovers each side's real endpoint through STUN and sets it on the running interface itself.

Bring the interface up on both nodes:

```bash
wg-quick up wg0
systemctl enable --now wg-quick@wg0
```

Verify the interface exists and the peer is configured (no endpoint or handshake yet — that's expected before stunmesh-go runs):

```bash
wg show
```

## Write the stunmesh-go config

Configuration is loaded from the first of these paths that exists (each directory is checked for `config.yaml`, then `config.yml`):

- `$STUNMESH_CONFIG_DIR/config.yaml`
- `/etc/stunmesh/config.yaml`
- `~/.stunmesh/config.yaml`
- `./config.yaml`

You can also point stunmesh-go at a specific file with `-c <file>` (aliases: `--config`), or at a directory with `--config-dir <dir>`. An explicitly given file or directory must exist — there is no fallback to the default search paths.

Write `/etc/stunmesh/config.yaml` on node A, using the built-in OpenDHT plugin. Node A's peer entry describes node B:

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "NODE_B":
        public_key: "<NODE_B_PUBLIC_KEY>"
        plugin: dht
stun:
  addresses: ["stun.l.google.com:19302"]
plugins:
  dht:
    type: builtin
    name: opendht
    endpoints:
      - https://dhtproxy2.jami.net
      - https://dhtproxy3.jami.net
```

On node B, write the same file with the peer name and public key swapped to describe node A instead (`"NODE_A"` with `<NODE_A_PUBLIC_KEY>`); `endpoints` stays the same on both nodes, since both publish into the same OpenDHT proxies.

The full option reference lives in [Configuration](configuration/overview.md), and the storage backends in [Storage Plugins](plugins/overview.md).

## Run stunmesh-go

On Linux, macOS, and FreeBSD, stunmesh-go needs raw socket access, so run it as root (Windows differs — see the [Windows guide](guides/windows.md)):

```bash
sudo ./stunmesh-go
```

On Linux, instead of running as root you can grant just the two capabilities it needs:

```bash
setcap cap_net_admin,cap_net_raw+ep ./stunmesh-go
```

Run it in the foreground on both node A and node B first, so you can see what happens:

```bash
sudo ./stunmesh-go
```

Wait roughly two refresh intervals (with `refresh_interval: "1m"` above, about two minutes). Then, on either node, check that the tunnel came up:

```bash
wg show
```

You should see an `endpoint` and a recent `latest handshake` for the peer. Confirm connectivity across the tunnel:

```bash
ping 10.0.0.2
```

(from node A; ping `10.0.0.1` from node B).

## Run as a systemd service

Once the foreground run works, stop it (Ctrl-C) and run stunmesh-go as a systemd service instead, tied to the WireGuard interface it manages:

```ini
# /etc/systemd/system/stunmesh-go.service
[Unit]
Description=stunmesh-go
After=wg-quick@wg0.service
BindsTo=wg-quick@wg0.service

[Service]
Type=simple
ExecStart=/usr/local/bin/stunmesh-go
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adjust `ExecStart` to wherever you placed the binary. Enable and start it on both nodes:

```bash
systemctl enable --now stunmesh-go
```

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
