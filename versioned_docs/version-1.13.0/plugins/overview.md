---
id: overview
title: Overview
sidebar_position: 1
---

# Storage Plugins

Peers exchange their encrypted endpoints through a storage backend. The plugin system lets you:

- **Use multiple storage backends**: different storage solutions for different peers
- **Name plugin instances**: configure multiple instances of the same plugin type
- **Assign plugins per peer**: each peer can use a different plugin instance

Every peer entry references a named instance from the `plugins:` section:

```yaml
plugins:
  cf_builtin:
    type: builtin
    name: cloudflare
    zone: example.com
    token: your_api_token_here

interfaces:
  wg0:
    peers:
      peer1:
        public_key: "base64_encoded_key"
        plugin: cf_builtin
```

## Plugin types

stunmesh-go supports three plugin types. All are fully supported and production-ready — choose based on your deployment needs:

| Type | Runs as | Protocol | Best for |
|---|---|---|---|
| [`builtin`](builtin.md) | Compiled into the binary | — | Single-binary deployment, minimal size |
| [`exec`](exec-protocol.md) | External process | JSON over stdin/stdout | Complex plugins, any language |
| [`shell`](shell-protocol.md) | External process | Shell variables over stdin | Simple shell scripts |

**Built-in** (`type: builtin`) — compiled directly into the stunmesh-go binary using build tags. Single binary, no external processes, no IPC overhead, faster startup, and an 83% smaller deployment size (2.2 MB vs 13.6 MB with external plugins). Available built-ins: `cloudflare`, `opendht`.

**Exec** (`type: exec`) — executes an external program speaking JSON over stdin/stdout. Plugins update independently of the main binary, can be written in any language, and are easier to debug and share.

**Shell** (`type: shell`) — a simplified protocol for shell scripts: variables over stdin, plain text out. No JSON parsing required; ideal for quick prototyping and gluing to existing shell tools.

## What plugins store

Plugins only store and retrieve an opaque hex string — the peer's endpoint JSON encrypted with a Curve25519 sealed box. No encryption or JSON parsing happens inside the plugin. See the [exec protocol page](exec-protocol.md#stored-data-format) for the data format details.

## Deduplication (`dedup`)

Any plugin instance can set `dedup: true` to skip re-publishing a peer's endpoint when it hasn't changed since the last successful publish:

- Type: boolean, default: `false`
- Set inside the plugin instance block, alongside `type` (applies to all peers using that instance)
- The comparison is done on the **plaintext** endpoint (`{"ipv4": "...", "ipv6": "..."}`), not the stored ciphertext, so it correctly detects "no change" even though the encrypted value differs on every publish (a fresh nonce is used each time)
- When enabled and the endpoint is unchanged, the storage write is skipped for that peer, reducing API calls and — for revision-tracking backends like a GitHub Gist — avoiding a pile-up of unnecessary revisions
- When disabled (the default), every peer is published on every refresh cycle

```yaml
plugins:
  cf_builtin:
    type: builtin
    name: cloudflare
    zone: example.com
    token: your_api_token_here
    dedup: true  # Skip re-publishing when the endpoint hasn't changed
```

:::warning

**Do not enable `dedup` for backends whose stored values expire or have a TTL** (e.g. a DHT with a short TTL). Those backends rely on periodic re-publishing to keep the value alive; if `dedup` skips the write, the value can expire and peers will fail to discover the endpoint. Only enable `dedup` for persistent backends (Cloudflare DNS, GitHub Gist, a durable KV store) where a written value remains until explicitly overwritten.

:::

## Contrib plugins

Standalone plugins live in the [`contrib/`](https://github.com/tjjh89017/stunmesh-go/tree/main/contrib) directory of the main repository:

- **Cloudflare DNS** (`exec`): stores peer information in Cloudflare DNS TXT records — [contrib/cloudflare/README.md](https://github.com/tjjh89017/stunmesh-go/blob/main/contrib/cloudflare/README.md)
- **OpenDHT** (`exec`): stores peer information in the OpenDHT distributed hash table — [contrib/opendht/README.md](https://github.com/tjjh89017/stunmesh-go/blob/main/contrib/opendht/README.md)
- **Cloudflare DNS shell** (`shell`): shell-script variant of the Cloudflare plugin — [contrib/cloudflare-shell](https://github.com/tjjh89017/stunmesh-go/tree/main/contrib/cloudflare-shell)
- **OpenDHT shell** (`shell`): OpenDHT without the `jq` dependency — POSIX `sh`, `sed`, `base64` and `curl` or `wget` are enough, so a default OpenWrt image (busybox + `uclient-fetch`) runs it as-is — [contrib/opendht-shell/README.md](https://github.com/tjjh89017/stunmesh-go/blob/main/contrib/opendht-shell/README.md)

Build them with `make plugin` from the repository root and reference them with their plugin type in your configuration. Community plugins are welcome.
