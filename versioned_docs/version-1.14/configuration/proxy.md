---
id: proxy
title: Proxy Mode
sidebar_position: 5
---

# Proxy Mode

On Windows, stunmesh-go always runs its own UDP proxy in front of WireGuard — there is no raw-socket or pcap option there, so proxy mode is the only mode. On Linux, macOS, and FreeBSD, stunmesh-go instead shares WireGuard's own UDP port by default (raw sockets on Linux, pcap on macOS/FreeBSD), but the same proxy can be opted into with `interfaces.<name>.proxy.enabled: true`.

Proxy mode owns the public-facing socket itself: it performs STUN directly on it and relays packets between the internet and a per-peer loopback listener, rewriting each peer's endpoint to that listener. See [Windows](../guides/windows.md) for how the proxy behaves in its always-on mode, and the [Full Tunnel guide](../guides/full-tunnel.md) for why and how to opt into it on the other platforms.

## `proxy.enabled`

Switches the interface between the platform's default socket-sharing mode and proxy mode. Absent means "use the platform default" — the key is never presence-triggered, so a config that only sets `proxy.listen` (below) does not accidentally turn proxy mode on, and the `proxy:` stanza can be kept in place while temporarily setting `enabled: false`.

| Platform | Default | `enabled: false` | `enabled: true` |
|---|---|---|---|
| Windows | `true` (only mode available) | **startup error**: Windows has no non-proxy mode | normal |
| Linux | `false` (raw-socket mode) | normal (default) | opt-in proxy mode |
| macOS | `false` (pcap mode) | normal (default) | opt-in proxy mode |
| FreeBSD | `false` (pcap mode) | normal (default) | opt-in proxy mode |

```yaml
interfaces:
  wg0:
    proxy:
      enabled: true
```

## `proxy.listen`

Fixed outer UDP port for the proxy; `0` or absent means an ephemeral port. Only meaningful when proxy mode is active (always on Windows, opt-in elsewhere via `proxy.enabled: true`) — validated but otherwise ignored when proxy mode is off. Useful for a port forward on the router, or a port-based firewall rule.

```yaml
interfaces:
  wg0:
    proxy:
      enabled: true   # required on Linux/macOS/FreeBSD; implicit on Windows
      listen: 51820   # fixed outer UDP port; 0 or absent = ephemeral
```

Without a fixed port, the outer port is ephemeral and pinned only for the life of the process — there is no persistence across restarts. Peers converge on the new port within a refresh cycle or two.

## `proxy.fib` (FreeBSD only)

The underlay FIB (routing table) number holding the physical default route, used by the FreeBSD tunnel-escape mechanism (`SO_SETFIB`) to let the proxy's outer sockets bypass a covering WireGuard default route. `0` (the default) means "not configured" — escape is a no-op, which is also correct since FIB 0 is where the covering WireGuard default route already lives. Only `fib > 0` activates it. Ignored on every other platform.

Setting `fib` to a nonzero value requires provisioning that FIB first — see [FreeBSD FIB prerequisite](../guides/full-tunnel.md#freebsd-fib-prerequisite) in the Full Tunnel guide.

```yaml
interfaces:
  wg0:
    proxy:
      enabled: true
      fib: 1
```
