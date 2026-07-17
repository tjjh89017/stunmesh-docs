---
id: stun-servers
title: STUN Servers
sidebar_position: 3
---

# STUN Server Configuration

stunmesh-go supports configuring one or more STUN servers. When multiple servers are provided, they are tried in order and the resolver falls back to the next server automatically on failure. If all servers fail, the endpoint is not published for that cycle and the next refresh cycle retries.

## Fields

- **`stun.address`** (string): a single STUN server address. Kept for backward compatibility — existing configurations that only set this field continue to work without any changes.
- **`stun.addresses`** (list of strings): a list of STUN servers to try in order. Servers are attempted sequentially; the first successful response is used.

Both fields can be used together. Duplicate entries across `address` and `addresses` are removed automatically, so listing the same server in both fields is safe.

## Example

```yaml
stun:
  address: "stun.l.google.com:19302"   # Single server (backward compatible)
  addresses:                           # Additional servers for fallback
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
    - "stun2.l.google.com:19302"
```

The effective server list after deduplication:

1. `stun.l.google.com:19302`
2. `stun1.l.google.com:19302`
3. `stun2.l.google.com:19302`

The resolver tries each in turn and uses the first one that returns a valid response.
