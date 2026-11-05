---
id: full-tunnel
title: Full Tunnel
sidebar_position: 5
---

# Full Tunnel

A "full tunnel" WireGuard peer routes *all* traffic through the tunnel — its `AllowedIPs` cover the whole address space (`0.0.0.0/0`, `::/0`, or the [`/1`+`/1` split](#11-allowedips-convention) below). That covering default route is exactly what stunmesh-go's own outbound traffic (STUN probes, and on the proxy the relayed packets) must escape: if it followed the tunnel like everything else, it would probe or relay through the very tunnel it is trying to establish.

Each platform escapes a covering default differently, and on some it requires opting into [proxy mode](../configuration/proxy.md).

:::caution Storage plugin traffic does not escape yet

The escape described on this page covers stunmesh-go's STUN probes and, in proxy mode, the relayed WireGuard packets. It does **not** yet cover the requests a storage plugin makes to its backend.

On a full tunnel that is a deadlock rather than a slow path: the call that fetches a peer's endpoint is routed into the tunnel that endpoint would bring up. It bites hardest on recovery — once a peer's endpoint changes the tunnel is broken, and repairing it needs the very call the broken tunnel is swallowing.

So a full tunnel needs explicit exclusion routes for the storage backend and for the resolver, so that traffic leaves through the physical path. Treat full tunnel as usable, but as something that needs this manual step rather than working out of the box.

Outside Linux the escape is exercised far less, so treat full tunnel on macOS, FreeBSD and Windows as lightly tested.

:::

## Linux — raw-socket mode (default)

Full tunnel is supported today without proxy mode. The pattern:

- Route WireGuard peer traffic over the default route in the mesh's own routing table, and mark WireGuard-originated packets with a firewall mark (`fwmark`) via the usual `wg-quick` `PostUp`/`PreUp` rules (a dedicated routing table plus an `ip rule` that excludes the marked traffic from the tunnel table).
- stunmesh-go mirrors that same fwmark onto its own STUN-probe socket (and, if proxy mode is also enabled, its proxy outer sockets — see below) via `SO_MARK`, so its own traffic escapes the tunnel the same way WireGuard's does.
- No extra stunmesh-go configuration is needed beyond the device's existing fwmark; stunmesh-go reads it from the device automatically. See [Firewall mark (fwmark)](../reference/platform-internals.md#firewall-mark-fwmark) for the raw-socket STUN probe's side of this.

## Linux — proxy mode (opt-in)

[`proxy.enabled: true`](../configuration/proxy.md#proxyenabled) is optional on Linux — raw-socket mode above already handles full tunnel without it. The reason to opt in instead is environments that cannot grant `CAP_NET_RAW` for the raw socket and BPF capture raw-socket mode needs, such as containers and hardened hosts. Proxy mode only needs `CAP_NET_ADMIN` (for WireGuard device configuration).

Raw-socket mode remains the recommended default — proxy mode adds a loopback hop. Treat proxy mode as the fallback for restricted environments, not a general recommendation.

```yaml
interfaces:
  wg0:
    proxy:
      enabled: true   # only if CAP_NET_RAW is unavailable
```

## macOS / FreeBSD — pcap mode (default): full tunnel not supported

pcap mode cannot make its own traffic, or WireGuard's, escape a covering default route: it doesn't own the outbound socket (stunmesh-go never owns the WireGuard socket on these platforms) and doesn't maintain routing-table bookkeeping. **Full tunnel on macOS or FreeBSD requires proxy mode** — set [`proxy.enabled: true`](../configuration/proxy.md#proxyenabled) and see the platform sections below.

## macOS / FreeBSD — proxy mode: full tunnel supported

With `proxy.enabled: true`, all outward traffic — STUN probes and the relayed WireGuard traffic — goes through stunmesh-go-owned sockets, so a per-socket escape applies:

- **macOS**: the proxy binds its outer socket to the physical default interface via `IP_BOUND_IF`/`IPV6_BOUND_IF`. The interface is looked up live (never cached) each time it's needed, and a route-change watcher re-applies the binding when the default interface changes (e.g. Wi-Fi to Ethernet handover) — the socket itself is never recreated, only rebound.
- **FreeBSD**: there is no per-socket bind-to-interface option, so stunmesh-go uses `SO_SETFIB` instead — see the FIB prerequisite below.

```yaml
interfaces:
  wg0:
    proxy:
      enabled: true
```

## FreeBSD FIB prerequisite

`SO_SETFIB` points a socket at a specific routing table (FIB); it does not create one. Provision a second FIB containing the physical default route before setting [`proxy.fib`](../configuration/proxy.md#proxyfib-freebsd-only):

```sh
# Enable multiple FIBs (requires reboot to take effect):
sysctl net.fibs=2

# Add to /etc/sysctl.conf to persist across reboots:
# net.fibs=2

# Add the physical default route to FIB 1 (adjust gateway/interface):
route -fib 1 add default 203.0.113.1

# Point stunmesh-go's proxy at FIB 1 in config.yaml:
# interfaces:
#   wg0:
#     proxy:
#       enabled: true
#       fib: 1
```

FIB 0 (the default table) is left holding the covering WireGuard default route; FIB 1 (or whichever number is chosen) holds only the physical route the proxy's outer sockets should use.

:::note

`fib: 0`, or omitting `fib`, leaves escape disabled — FIB 0 is where the tunnel's covering default route already lives. Setting `fib` to a nonzero but unprovisioned number causes egress failures. Verify with `route -fib N get <stun-server-ip>` before flipping `proxy.enabled` in production.

:::

## Windows — unchanged

Windows was already proxy-only before full-tunnel support existed elsewhere, so there is nothing new here. See the [Windows guide](windows.md).

## `/1`+`/1` AllowedIPs convention

Some WireGuard full-tunnel guides use `0.0.0.0/1` + `128.0.0.0/1` (and the IPv6 equivalent, `::/1` + `8000::/1`) instead of a single `0.0.0.0/0` (`::/0`). Both conventions are functionally equivalent full-tunnel `AllowedIPs` sets — together the `/1`+`/1` pair covers the same address space as `/0`.

The split is a **human-debugging aid**, nothing more: it keeps the physical default route visible in `ip route` / `netstat -rn` output instead of letting WireGuard's `/0` install a route that shadows it, making it easier to confirm the underlying default route is still intact while troubleshooting.

It is not required by, and does not change the behavior of, any of the escape mechanisms described above — those work identically whether a peer's `AllowedIPs` uses `/0` or the `/1`+`/1` pair. The split does none of the escape work itself.

## How tunnel escape works

"Escape" is the per-OS mechanism above that lets stunmesh-go's own outbound packets bypass a covering WireGuard default route.

- Escape is only applied when a covering default route is actually detected on the relevant tunnel interface(s) — either a `/0` or a `/1`+`/1` pair. If no covering default is present, nothing is applied and behavior is unchanged from a split-tunnel setup.
- Covering-route detection runs per address family (IPv4/IPv6 checked independently), and only against interfaces stunmesh-go itself manages (its configured WireGuard interfaces) — a covering default route on an unrelated tunnel does not trigger escape.
- Where the mechanism binds to an interface rather than a routing mark (macOS's `IP_BOUND_IF`, Windows' `IP_UNICAST_IF`), a change in the system's default-route interface (e.g. switching networks) is detected via a live OS notification (a routing socket on macOS, an interface-change notification on Windows) and the binding is re-applied automatically. The proxy's socket itself is never recreated, so this does not interrupt an ongoing session the way replacing the socket would.
- Where the mechanism is a routing mark or table selection applied once at socket creation (Linux's fwmark mirror, FreeBSD's FIB), no change watcher is needed — the mark or table choice persists on the file descriptor for its lifetime regardless of later route changes.

:::caution Preliminary — pending hardware validation

Toggling the tunnel off and on in the OS's UI or service (not just restarting stunmesh-go) may re-apply the original tunnel configuration and wipe the loopback-endpoint rewrites stunmesh-go made, requiring a stunmesh-go restart afterward. This is confirmed behavior on [Windows](windows.md#limitations) already. Whether, or how, it applies on macOS and FreeBSD is **unconfirmed** — this note will be updated with the platform-specific results once verified on real hardware.

:::
