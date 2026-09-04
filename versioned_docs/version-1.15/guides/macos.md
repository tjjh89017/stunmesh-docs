---
id: macos
title: macOS behind LTE/5G
sidebar_position: 2
---

# macOS Laptops behind LTE/5G Routers

Suppose you have two LTE/5G uplinks and two downstream macOS (or Linux) computers. This walkthrough uses the following demo setup:

**Site A:**
1. Netgear M5 5G router (Asia Pacific Telecom, now Far EasTone Telecom)
2. Intel-based macOS machine — `Intel Mac`

**Site B:**
1. iPhone 15 Pro hotspot (Chunghwa Telecom 4G LTE SIM)
2. MacBook Air M3 — `Mac M3`

You can mix setups freely — for example a VyOS router on one side and a Mac on the other, as long as both run stunmesh-go.

## Steps in Site A

1. Connect the `Intel Mac` to the Netgear M5 for internet access.
2. Install wireguard-go and wireguard-tools (e.g. via Homebrew).
3. Download the stunmesh-go binary for your Mac's architecture to `/tmp/stunmesh-go`.
4. Prepare the WireGuard configuration below.
5. Prepare `config.yaml` below — fill in the `utunX` interface reported by `wg-quick`.
6. Bring the tunnel up: `wg-quick up /tmp/wg0.conf`
7. Run stunmesh-go: `cd /tmp; sudo ./stunmesh-go`
8. Wait for it to connect (usually within 2 × `refresh_interval`).

WireGuard config `/tmp/wg0.conf`:

```ini
[Interface]
PrivateKey = <INTEL_MAC_PRIVATE_KEY>
Address = 192.168.10.1/24

[Peer]
PublicKey = <MAC_M3_PUBLIC_KEY>
AllowedIPs = 192.168.10.0/24
PersistentKeepalive = 25
```

stunmesh-go `/tmp/config.yaml`:

```yaml
---
refresh_interval: "1m"
log:
  level: "debug"
interfaces:
  "<utunX>":
    peers:
      "MAC_M3":
        public_key: "<MAC_M3_PUBLIC_KEY>"
        plugin: cloudflare_main
stun:
  address: "stun.l.google.com:19302"
plugins:
  cloudflare_main:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "<ZONE_NAME>", "-token", "<API_TOKEN>"]
```

## Steps in Site B

Same procedure on the `Mac M3`, with the keys and names mirrored:

WireGuard config `/tmp/wg0.conf`:

```ini
[Interface]
PrivateKey = <MAC_M3_PRIVATE_KEY>
Address = 192.168.10.2/24

[Peer]
PublicKey = <INTEL_MAC_PUBLIC_KEY>
AllowedIPs = 192.168.10.0/24
PersistentKeepalive = 25
```

stunmesh-go `/tmp/config.yaml`:

```yaml
---
refresh_interval: "1m"
log:
  level: "debug"
interfaces:
  "<utunX>":
    peers:
      "INTEL_MAC":
        public_key: "<INTEL_MAC_PUBLIC_KEY>"
        plugin: cloudflare_main
stun:
  address: "stun.l.google.com:19302"
plugins:
  cloudflare_main:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "<ZONE_NAME>", "-token", "<API_TOKEN>"]
```

## Verify

Ping the other side, or use `wg` to show handshake status.
