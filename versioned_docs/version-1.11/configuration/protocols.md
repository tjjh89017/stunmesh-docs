---
id: protocols
title: IPv4 / IPv6 Protocols
sidebar_position: 2
---

# Protocol Configuration

stunmesh-go supports both IPv4 and IPv6 for STUN discovery and peer connections. Protocol configuration operates at two levels: the **interface** level controls what gets discovered and published, the **peer** level controls which endpoint each peer actually uses.

## Interface protocol

Controls which STUN discovery protocols are used for the interface:

- `ipv4` (default): IPv4 STUN discovery only
- `ipv6`: IPv6 STUN discovery only
- `dualstack`: both IPv4 and IPv6 STUN discovery

```yaml
interfaces:
  wg0:
    protocol: "ipv4"      # IPv4 only (default if not specified)
    peers: {}
  wg1:
    protocol: "ipv6"      # IPv6 only
    peers: {}
  wg2:
    protocol: "dualstack" # Both IPv4 and IPv6
    peers: {}
```

## Peer protocol

Controls which endpoint a peer will use when establishing connections:

- `ipv4` (default): use only the IPv4 endpoint
- `ipv6`: use only the IPv6 endpoint
- `prefer_ipv4`: prefer IPv4, fall back to IPv6 if IPv4 is unavailable
- `prefer_ipv6`: prefer IPv6, fall back to IPv4 if IPv6 is unavailable

```yaml
interfaces:
  wg0:
    protocol: "dualstack"  # Publish both IPv4 and IPv6 endpoints
    peers:
      peer1:
        public_key: "<BASE64_KEY>"
        plugin: cloudflare1
        protocol: "ipv4"         # This peer will only use IPv4
      peer2:
        public_key: "<BASE64_KEY>"
        plugin: cloudflare1
        protocol: "prefer_ipv6"  # Prefer IPv6, fallback to IPv4
      peer3:
        public_key: "<BASE64_KEY>"
        plugin: cloudflare1
        # protocol not specified - defaults to "ipv4"
```

## How the two levels interact

- The interface protocol determines which endpoints are **discovered and published**.
- The peer protocol determines which endpoint to **use** from the published data.
- For `dualstack` interfaces both endpoints are stored, and each peer selects which one to use.
- Published endpoint data is a single encrypted JSON object: `{"ipv4": "...", "ipv6": "..."}`. Field presence follows the interface protocol; an empty string means STUN discovery failed for that family.

## Requirements and caveats

- The STUN server must support the chosen protocol — not all STUN servers support IPv6.
- The network must have working IPv6 configuration and routing for IPv6 discovery to succeed.
- [Ping monitoring](ping-monitoring.md) currently only supports IPv4 targets, independent of the STUN protocol setting.
