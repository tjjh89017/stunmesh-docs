---
id: ping-monitoring
title: Ping Monitoring
sidebar_position: 4
---

# Ping Monitoring

stunmesh-go supports ping monitoring to detect tunnel health and automatically trigger reconnection when issues are detected.

## Features

- **Per-peer monitoring**: each peer can have its own target IP and ping settings
- **Adaptive retry logic**: intelligent failure handling with backoff
- **Automatic recovery**: triggers publish/establish operations on ping failure
- **Configurable timeouts**: per-peer or global interval and timeout settings

## How it works

1. **Normal operation**: pings the target IP at the configured interval (constant frequency).
2. **Failure detection**: when a ping fails, immediately triggers publish and establish for the specific failing peer.
3. **Separate retry logic**:
   - Ping monitoring continues at the constant configured interval regardless of failures.
   - Publish/establish retries run on an independent schedule with adaptive backoff: always publish the failing peer's endpoint first, then establish.
   - First 3 retries: fixed 2-second intervals.
   - After 3 retries: arithmetic progression backoff (10s, 12s, 14s, 16s, 18s...).
   - Capped at `refresh_interval`: hands over to the normal refresh cycle; ping monitoring continues.
4. **Recovery**: on a successful ping, retry logic resets.

## Configuration

Global defaults:

```yaml
ping_monitor:
  interval: "5s"        # Default ping interval
  timeout: "2s"         # Default ping timeout
  fixed_retries: 3      # Fixed retry attempts before backoff
```

Per-peer settings:

```yaml
interfaces:
  wg0:
    peers:
      "peer1":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: cloudflare1
        ping:
          enabled: true
          target: "192.168.1.100"     # IP to ping through tunnel
          interval: "60s"             # Override global interval (optional)
          timeout: "10s"              # Override global timeout (optional)
      "peer2":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: cloudflare2
        ping:
          enabled: true
          target: "10.0.0.50"
          # Uses global interval and timeout defaults
      "peer3":
        public_key: "<PUBLIC_KEY_IN_BASE64>"
        plugin: cloudflare2
        # No ping configuration = ping monitoring disabled
```

### Parameters

The entire `ping` section is optional — if omitted, ping monitoring is disabled for that peer.

| Parameter | Description |
|---|---|
| `enabled` | Enable ping monitoring for this peer (default: `false`). |
| `target` | IP address to ping through the tunnel (required if enabled). |
| `interval` | How often to ping (optional, uses global default). |
| `timeout` | Max time to wait for a response (optional, uses global default). |

## Limitations

- **IPv4 only**: ping monitoring currently supports IPv4 addresses only.
- **IP address required**: `target` must be an IP address, not a domain name.
- **Independent of STUN protocol**: you can use IPv6 STUN discovery with an IPv4 ping target; ping always uses IPv4 regardless of the interface protocol setting.

Examples:

- ✅ Valid: `"192.168.1.100"`, `"10.0.0.1"`, `"172.16.0.50"`
- ❌ Invalid: `"router.local"`, `"google.com"`, `"2001:db8::1"` (IPv6 not supported for ping)

## Use cases

- **Tunnel health monitoring**: detect when the WireGuard tunnel stops working
- **Automatic recovery**: reconnect without manual intervention
- **Network redundancy**: faster failover than waiting for `refresh_interval`
