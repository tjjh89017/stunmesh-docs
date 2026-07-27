---
id: overview
title: Overview
sidebar_position: 1
---

# Configuration Overview

Configuration is loaded from the first of these paths that exists (each directory is checked for `config.yaml`, then `config.yml`):

- `$STUNMESH_CONFIG_DIR/config.yaml`
- `/etc/stunmesh/config.yaml`
- `~/.stunmesh/config.yaml`
- `./config.yaml`

Two CLI flags override the search: `-c <file>` (alias `--config`) reads exactly that file, and `--config-dir <dir>` looks for `config.yaml`/`config.yml` in that directory. An explicit file or directory must exist — startup fails hard instead of falling back to the defaults. If no config file is found via the default search, stunmesh-go starts with built-in defaults.

The config file must be YAML. Environment variables cannot override config values, and values are **not** expanded — a token written as `${MY_TOKEN}` is sent to the storage backend literally. Write secrets directly into the file (environment variables are only expanded inside the search paths themselves, e.g. `$STUNMESH_CONFIG_DIR`).

:::note

The config is read **once at startup** — there is no reload. Restart stunmesh-go after editing it. See [when stunmesh-go must be restarted](../getting-started.md#when-stunmesh-go-must-be-restarted).

:::

## Full example

```yaml
---
refresh_interval: "1m"
log:
  level: "debug"
interfaces:
  wg0:
    protocol: "ipv4"  # Optional: "ipv4" (default), "ipv6", or "dualstack" for STUN discovery
    peers:
      "<PEER_NAME>":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: cloudflare1
        protocol: "ipv4"  # Optional: peer protocol selection (default: "ipv4")
        ping:
          enabled: true
          target: "192.168.1.100"
  wg1:
    protocol: "dualstack"  # Discover both IPv4 and IPv6 endpoints
    peers:
      "<PEER_NAME>":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: cloudflare2
        protocol: "prefer_ipv6"  # Prefer IPv6, fallback to IPv4
        ping:
          enabled: true
          target: "10.0.0.50"
          interval: "60s"
          timeout: "10s"
      "<ANOTHER_PEER>":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: exec_plugin1
        # protocol defaults to "ipv4" if not specified
        # ping configuration is completely optional
stun:
  address: "stun.l.google.com:19302"   # Single server (backward compatible)
  addresses:                           # Optional: list of servers for fallback
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
    - "stun2.l.google.com:19302"
ping_monitor:
  interval: "5s"
  timeout: "2s"
  fixed_retries: 3
plugins:
  cloudflare1:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "example.com", "-token", "<CLOUDFLARE_API_TOKEN>", "-subdomain", "wg"]
  cloudflare2:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "example.com", "-token", "<CLOUDFLARE2_API_TOKEN>"]
  exec_plugin1:
    type: exec
    command: "python3"
    args: ["/path/to/script.py", "--config", "/path/to/config"]
```

## Top-level fields

| Field | Description |
|---|---|
| `refresh_interval` | How often endpoints are re-discovered, re-published, and re-established (Go duration string, e.g. `"1m"`). |
| `log.level` | Log verbosity: `trace`, `debug`, `info` (default), `warn`, `error`, `fatal`, `panic`, or `disabled`. An unrecognized value is a startup error. |
| `log.format` | `console` (default, human-readable) or `json` (one object per line, for log aggregation). |
| `interfaces` | WireGuard interfaces to manage, each with its [protocol](protocols.md#interface-protocol) and peer list. |
| `stun` | STUN server(s) for endpoint discovery — see [STUN Servers](stun-servers.md). |
| `ping_monitor` | Global defaults for [ping monitoring](ping-monitoring.md). |
| `plugins` | Named storage plugin instances — see [Storage Plugins](../plugins/overview.md). |

## Per-interface fields

Each entry under `interfaces:` is keyed by the WireGuard interface name (`wg0`, `utun7`, …).

| Field | Required | Description |
|---|---|---|
| `peers` | yes | The peers to manage on this interface. |
| `protocol` | no | Which families to run STUN discovery for — `ipv4` (default), `ipv6`, or `dualstack`. See [Interface Protocol](protocols.md#interface-protocol). |
| `listen_interfaces` | no | FreeBSD/macOS only. Underlay interfaces to capture STUN responses on. Empty (default) means all eligible interfaces. See [Restricting listen interfaces](../reference/platform-internals.md#restricting-listen-interfaces). |
| `listen_default_route` | no | FreeBSD/macOS only. Also capture on the default-route interface, resolved per-protocol. Defaults to `false`. Additive with `listen_interfaces`. |
| `proxy` | no | Proxy mode settings (`enabled`, `listen`, `fib`) — see [Proxy Mode](proxy.md). Always on for Windows; opt-in elsewhere, required for full tunnel on macOS/FreeBSD. |

:::note

`listen_interfaces` and `listen_default_route` have no effect on Linux, whose raw socket listens system-wide. Setting either key there logs a one-time warning and is otherwise ignored.

:::

## Per-peer fields

| Field | Required | Description |
|---|---|---|
| `public_key` | yes | The peer's WireGuard public key (base64). |
| `plugin` | yes | Name of the plugin instance (from `plugins:`) used to exchange this peer's endpoint. |
| `protocol` | no | Which endpoint family to use when establishing — see [Peer Protocol](protocols.md#peer-protocol). Defaults to `ipv4`. |
| `ping` | no | Per-peer tunnel health monitoring — see [Ping Monitoring](ping-monitoring.md). |
