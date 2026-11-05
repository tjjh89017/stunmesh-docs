---
id: builtin
title: Built-in Plugins
sidebar_position: 2
---

# Built-in Plugins

Built-in plugins are compiled directly into the stunmesh-go binary. Release binaries include all of them: `cloudflare`, `opendht`, `trace` and `mirror`. A source build includes them too. To drop one, or to build a binary with your own plugin, see [Building from Source](../reference/build.md#built-in-plugins) and [Custom Binaries and Go Plugins](custom-binary.md).

`cloudflare` and `opendht` store data. `trace` and `mirror` (new in v1.16.0) store nothing themselves. They wrap other plugin instances; see [Chaining plugins](overview.md#chaining-plugins).

## Cloudflare DNS

Stores each peer's encrypted endpoint in a Cloudflare DNS TXT record named `<sha1 in hex>.<subdomain>.<your_domain>` (or `<sha1 in hex>.<your_domain>` if no subdomain is configured).

```yaml
plugins:
  cf_builtin:
    type: builtin
    name: cloudflare
    zone: example.com
    token: your_api_token_here
    subdomain: stunmesh  # Optional
```

| Field | Required | Description |
|---|---|---|
| `zone` | yes | The Cloudflare zone (your domain). |
| `token` | yes | API token with DNS edit permission for the zone. The value is used literally — env vars are not expanded. |
| `subdomain` | no | Subdomain under which records are created. |

TLS to the Cloudflare API relies on the system's CA store unless the binary was built with `EMBED_CA=1` (the `-ca` release variant and the Docker image), which embeds a Mozilla CA fallback bundle for systems that don't ship a `ca-certificates` package (OpenWrt, scratch containers).

## OpenDHT

Stores endpoints in the [OpenDHT](https://github.com/savoirfairelinux/opendht) distributed hash table through an OpenDHT proxy server's REST API. It needs no account, token, or quota, since there is no operator.

At least one proxy endpoint is required — there is no built-in default, since which proxy your mesh trusts is a decision to make, not to inherit. Repeat `endpoints` to add fallbacks; the plugin tries them in order and only moves on when a request fails.

```yaml
plugins:
  dht:
    type: builtin
    name: opendht
    endpoints:                           # Required, one or more; needs a scheme
      - https://dhtproxy2.jami.net
      - https://dhtproxy3.jami.net
    magic: stunmesh-v1                   # Default; tags our own values
    timeout: 15s                         # Default; also accepts a number of seconds
    dedup: false                         # Must stay false, see below
```

Each endpoint must include an explicit `http://` or `https://` scheme, or startup fails — a bare host is rejected rather than silently defaulting to `http`. The singular `endpoint:` is still accepted and merged in front of `endpoints`.

:::warning

`dedup` must stay `false` here: OpenDHT values expire after 10 minutes, and nothing but the refresh cycle republishes them. See [Deduplication](overview.md#deduplication-dedup).

:::

Savoir-faire Linux runs several public proxies for Jami; `dhtproxy2.jami.net` and `dhtproxy3.jami.net` are reachable over both IPv4 and IPv6, so listing both from different regions costs nothing until the first breaks. Avoid the bare `dhtproxy.jami.net`, which round-robins over an address that no longer serves. DHT lookups take seconds rather than milliseconds. The trade-offs, which proxies to use, and how to run your own are covered in [opendht/README.md](https://github.com/tjjh89017/stunmesh-plugins/blob/main/opendht/README.md) in the stunmesh-plugins repository — that plugin is the same design as a shell script, and its documentation applies here too.

## Trace

New in v1.16.0. Forwards every `get` and `set` unchanged to one other instance, and records each call. Use it to see what stunmesh asks of a backend.

```yaml
plugins:
  cf:
    type: builtin
    name: cloudflare
    zone: example.com
    token: your_api_token_here

  cf_traced:
    type: builtin
    name: trace
    next: cf                                # Required: the instance to wrap
    file: /var/log/stunmesh-trace.jsonl     # Optional
```

| Field | Required | Description |
|---|---|---|
| `next` | yes | Name of the instance to forward to. Any type: `builtin`, `exec` or `shell`. |
| `file` | no | Append one JSON line per call to this file. Without it, each call is logged at `debug` level. |

Each record holds the time, the operation, the device, both public keys, the storage key, the value length, the duration and the result. It never holds the value itself:

```json
{"time":"2026-11-01T10:00:00Z","op":"set","device":"wg0","local_public_key":"...","peer_public_key":"...","key":"3061b8fc...","value_len":184,"duration_ms":212.4,"ok":true}
```

## Mirror

New in v1.16.0. Writes to several instances and reads from the first one that answers. Use it to publish to two backends, so a peer can still find you when one backend is down.

```yaml
plugins:
  cf:
    type: builtin
    name: cloudflare
    zone: example.com
    token: your_api_token_here

  dht:
    type: builtin
    name: opendht
    endpoints:
      - https://dhtproxy2.jami.net

  both:
    type: builtin
    name: mirror
    stores: [cf, dht]   # Required: one or more instance names, in order
```

| Field | Required | Description |
|---|---|---|
| `stores` | yes | List of instance names. |

- **Set** writes to every instance in the list. It fails if any write fails.
- **Get** asks the instances in list order and returns the first non-empty value. It fails only when no instance has a value.

:::warning

Do not set `dedup: true` on a `mirror` that contains a backend with a TTL, such as `opendht`. The skipped write lets the OpenDHT value expire. See [Deduplication](overview.md#deduplication-dedup).

:::
