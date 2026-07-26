---
id: windows
title: Windows
sidebar_position: 4
---

# Windows

Windows has no equivalent of the raw sockets (Linux) or pcap (macOS/FreeBSD) stunmesh-go uses to share WireGuard's UDP port on the other platforms. Instead, stunmesh-go on Windows runs a **local UDP proxy** that owns the public-facing socket, performs STUN on it directly, and relays WireGuard packets between the internet and per-peer loopback listeners.

The official [WireGuard for Windows](https://www.wireguard.com/install/) client stays the data plane — stunmesh-go does not embed a WireGuard implementation. It rewrites each peer's endpoint to its loopback listener itself, so there is nothing to change by hand in the tunnel configuration.

```
internet ⇄ [outer socket: STUN + relay] ⇄ 127.0.0.1 ⇄ WireGuardNT
                 (stunmesh-go proxy)
```

Because the proxy owns the outward socket for the life of the process, the public port stays stable across refresh cycles — the property NAT traversal depends on.

## Quickstart

1. Install the official WireGuard for Windows client and create the tunnel (key, `ListenPort`, peers with `AllowedIPs`; leave `Endpoint` unset — stunmesh-go manages it).
2. **Activate the tunnel before starting stunmesh-go.**
3. Run stunmesh-go from an **Administrator** console. The WireGuard service requires the same privilege; without it stunmesh-go fails at the first device access with a "run stunmesh as Administrator" error.

```powershell
.\stunmesh.exe -c C:\stunmesh\config.yaml
```

The configuration file is unchanged from the other platforms; see [Configuration](../configuration/overview.md).

## Fixed outer port

The proxy needs no configuration of its own. Set `interfaces.<name>.proxy.listen` only if you need a fixed outer port — for a port forward on the router, or a port-based firewall:

```yaml
interfaces:
  wg0:
    proxy:
      listen: 51820   # fixed outer UDP port; 0 or absent = ephemeral
    peers:
      ...
```

On the other platforms the key is ignored — there is no proxy to configure.

## Limitations

- **Restart stunmesh-go after any tunnel toggle.** Deactivating and reactivating a tunnel in the WireGuard UI re-applies the `.conf` file, wiping the endpoints stunmesh-go set. Activate the tunnel first, then start (or restart) stunmesh-go.
- **Outer ports are ephemeral** (unless pinned with `proxy.listen`) and pinned only for the life of the process; there is no persistence across restarts. Peers converge on the new port within a refresh cycle or two.
- **ICMP ping monitoring is not implemented on Windows yet**; stunmesh-go logs this and continues without it.
