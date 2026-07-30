---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

# STUNMESH-go

STUNMESH-go is a WireGuard helper tool that establishes peer-to-peer connections through NAT — without any self-hosted coordination infrastructure.

It discovers each node's public IP and port via STUN, encrypts the endpoint information, and shares it through a pluggable storage backend (Cloudflare DNS, OpenDHT, or your own script). Every node reads its peers' endpoints from the same storage and configures WireGuard accordingly. No rendezvous server, no relay, no VPS in the middle.

Inspired by manuels' [wireguard-p2p](https://github.com/manuels/wireguard-p2p) project.

## How it works

1. **Discover** — send a STUN request from the same port WireGuard listens on, using a raw socket with a BPF filter, to learn the public IP and port of the NAT mapping.
2. **Publish** — encrypt the endpoint with a Curve25519 sealed box and store it in the configured storage plugin, keyed by a SHA-1 digest of the peer pair.
3. **Establish** — retrieve and decrypt the remote peer's endpoint from storage, then set it on the WireGuard interface.
4. **Repeat** — refresh on an interval (and on ping failure, if [ping monitoring](configuration/ping-monitoring.md) is enabled) so the tunnel survives NAT rebinding.

## NAT type support

| NAT type | Support |
|---|---|
| Full Cone NAT | ✅ Fully supported |
| Restricted Cone NAT | ✅ Fully supported |
| Port Restricted Cone NAT | ✅ Fully supported |
| Symmetric NAT | ⚠️ Difficult to support due to unpredictable port mapping |

For best results, ensure at least one peer is behind a cone NAT type.

## Supported platforms

- **Linux** (amd64, arm, arm64, mipsle)
- **macOS** (amd64, arm64)
- **FreeBSD** (amd64, arm64) — requires `wireguard-tools`
- **Windows** (amd64, arm64) — requires the official WireGuard for Windows client; see the [Windows guide](guides/windows.md)
- **Android** — a separate app, [stunmesh-android](https://github.com/tjjh89017/stunmesh-android), which embeds this project's STUN core alongside a userspace WireGuard implementation and runs as a VPN service (no root required)

:::note

stunmesh-android is in early development. Install it by sideloading the universal APK from its [releases page](https://github.com/tjjh89017/stunmesh-android/releases). Only the built-in storage plugins are available there, and exempting the app from battery optimization is recommended for long-lived tunnels.

:::

:::important

FreeBSD binaries use the `wgcli` backend, which invokes `wg(8)`. The base system ships the `if_wg` kernel module but not that tool, so `pkg install wireguard-tools` is required. See [Backend Selection](reference/build.md#backend-selection).

:::

:::note

On macOS only wireguard-go is supported. The WireGuard App Store version is not supported because of its sandbox.

:::

## Tested with

- VyOS 2025.07.14-0022-rolling (built-in WireGuard kernel module)
- Ubuntu with WireGuard kernel module
- macOS wireguard-go 0.0.20230223, wireguard-tools 1.0.20210914
- FreeBSD 14.3-RELEASE (built-in WireGuard kernel module, with wireguard-tools installed)
- OPNsense 25.1 (built-in WireGuard)
- EdgeRouter X (EdgeOS 3.0.0)
- Windows 11 25H2 (WireGuard for Windows 1.1)

## Talks and presentations

- [FOSDEM 2026 — STUNMESH-go: Building P2P WireGuard Mesh Without Self-Hosted Infrastructure](https://fosdem.org/2026/schedule/event/YQWEDC-stunmesh-go_building_p2p_wireguard_mesh_without_self-hosted_infrastructure/)
- [Slides](https://speakerdeck.com/tjjh89017/fosdem-2026-stunmesh-go-building-p2p-wireguard-mesh-without-self-hosted-infrastructure)
- [Recording](https://video.fosdem.org/2026/h1302/YQWEDC-stunmesh-go_building_p2p_wireguard_mesh_without_self-hosted_infrastructure.av1.webm)

## Roadmap

- Auto execution when the routing engine notifies a change

## License

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.
