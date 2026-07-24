---
id: platform-internals
title: Platform Internals
sidebar_position: 2
---

# Platform Internals

stunmesh-go sends a STUN request **from the same UDP port WireGuard listens on**, so the NAT mapping it discovers is the one WireGuard's own traffic will use. Since that port is owned by WireGuard, the response is captured with a raw socket (Linux) or BPF/pcap (FreeBSD/macOS) plus a BPF filter matching STUN packets. The public endpoint is then encrypted with a Curve25519 sealed box and stored via the configured [storage plugin](../plugins/overview.md).

## Linux

Uses raw sockets with BPF filtering to listen system-wide — no interface-specific limitations.

### Firewall mark (fwmark)

STUN discovery probes from the WireGuard listen port to learn the NAT mapping that WireGuard's own traffic will use. That only holds if the probe and the tunnel traffic leave by the same route.

They need not. WireGuard stamps an fwmark on the packets it sends so that policy routing can keep its own traffic out of the tunnel it manages — this is what `wg-quick` sets up when `Table = auto` installs a default route through the tunnel. An unmarked probe would miss those rules, take a different path, and report a mapping that belongs to some other route.

So on Linux, stunmesh-go reads the device's fwmark and applies it to the probe socket with `SO_MARK`. This is automatic, needs no configuration, and does nothing when the device has no fwmark set — which is the common case.

Two caveats:

- **It does not make an exit-node / full-tunnel setup work on its own.** stunmesh-go never touches the routing table. The `ip rule` and routing table entries that consume the mark are `wg-quick`'s job (or yours). stunmesh-go only makes sure its probe joins the traffic class WireGuard already put itself in.
- **`SO_MARK` is Linux-only.** FreeBSD and macOS have no equivalent, so the probe socket cannot be pinned to the device's routing path there.

## FreeBSD and macOS (BSD-based systems)

Uses BPF with interface-specific packet capture. By default stunmesh-go listens on all eligible network interfaces for STUN response messages, excluding the specific WireGuard interface being managed. This provides better resilience for systems with multiple network paths or backup routes compared to a single default-route dependency.

### Restricting listen interfaces

By default the BSD backend opens a capture handle on every eligible interface. On a host with many interfaces that is wasteful, and on some it is undesirable. Two per-interface options narrow it down:

```yaml
interfaces:
  wg0:
    protocol: "dualstack"
    listen_interfaces: ["em0", "em1"]   # only capture on these
    listen_default_route: true          # also capture on the default-route interface
```

- **`listen_interfaces`** (list of strings, default empty): the underlay interfaces to capture on. Empty means "all eligible" — the historical behavior.
- **`listen_default_route`** (bool, default `false`): additionally capture on the interface that carries the default route, resolved per-protocol (the IPv4 and IPv6 default routes may live on different interfaces).

The two are **additive, not mutually exclusive** — the effective set is the union of `listen_interfaces` and, when `listen_default_route` is `true`, the default-route interface. When both are unset the backend listens on all eligible interfaces, so existing configs are unaffected.

Semantics:

- If neither option is set, all eligible interfaces are used (unchanged default).
- A name in `listen_interfaces` that does not exist on the system, or an interface that cannot be opened right now, is warned about and skipped rather than fatal — the daemon retries every refresh cycle. If the selection ends up empty, discovery fails loudly for that protocol (in `dualstack` a single failed family is tolerated as long as the other succeeds).
- **Linux ignores both options.** Its raw socket is system-wide with no per-interface listen; setting either key logs a one-time warning and has no other effect.

## STUN capture details

For contributors working on the STUN capture path:

**Linux:**

- The kernel strips IP headers for both IPv4 and IPv6 raw sockets at the application layer, so the application always parses from the UDP header (skip 8 bytes to the payload).
- BPF filters run at different stages for IPv4 vs IPv6:
  - **IPv4**: the filter sees the full packet (IP header + UDP header + payload) — dst_port at offset 22, STUN magic at 32.
  - **IPv6**: the filter sees the packet without the IP header (UDP header + payload) — dst_port at offset 2, STUN magic at 12.
- IPv6 uses `golang.org/x/net/ipv6.PacketConn`; the mandatory IPv6 UDP checksum (RFC 8200) is handled by the kernel via `SetChecksum(true, 6)`.

**FreeBSD/macOS:**

- Uses pcap with BPF filters.
- Different link layer types (Null/Loopback vs Ethernet) require different BPF offsets.
- The IPv6 BPF filter checks the EtherType (0x86DD) for Ethernet frames.

## Encryption and storage format

The endpoint data published to storage is a single JSON object:

```json
{
  "ipv4": "1.2.3.4:5678",
  "ipv6": "[2001:db8::1]:5678"
}
```

- The entire JSON is encrypted using NaCl box (Curve25519 + XSalsa20 + Poly1305) and hex-encoded for storage.
- Plugins store and retrieve only the hex string — no JSON parsing or crypto inside plugins.
- On establish, the controller decrypts the JSON and selects an endpoint according to the [peer protocol](../configuration/protocols.md#peer-protocol), with fallback logic for `prefer_ipv4` / `prefer_ipv6`.
- With the Cloudflare backend, records are named `<sha1 in hex>.<subdomain>.<your_domain>` (or `<sha1 in hex>.<your_domain>` without a subdomain).
