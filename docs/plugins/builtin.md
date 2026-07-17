---
id: builtin
title: Built-in Plugins
sidebar_position: 2
---

# Built-in Plugins

Built-in plugins are compiled directly into the stunmesh-go binary. Release binaries include all of them; when building from source, select them with the `BUILTIN` make variable — see [Building from Source](../reference/build.md#built-in-plugin-options).

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
| `token` | yes | API token with DNS edit permission for the zone. Supports `${ENV_VAR}` expansion. |
| `subdomain` | no | Subdomain under which records are created. |

## OpenDHT

Stores endpoints in the [OpenDHT](https://github.com/savoirfairelinux/opendht) distributed hash table through an OpenDHT proxy server's REST API. It needs no account, token, or quota, since there is no operator. Every field is optional:

```yaml
plugins:
  dht:
    type: builtin
    name: opendht
    endpoint: https://dhtproxy.jami.net  # Default
    magic: stunmesh-v1                   # Default; tags our own values
    timeout: 15s                         # Default; also accepts a number of seconds
    dedup: false                         # Must stay false, see below
```

:::warning

`dedup` must stay `false` here: OpenDHT values expire after 10 minutes, and nothing but the refresh cycle republishes them. See [Deduplication](overview.md#deduplication-dedup).

:::

Note also that `dhtproxy.jami.net` answers over **IPv6 only**, and that DHT lookups take seconds rather than milliseconds. The trade-offs, and how to run your own proxy, are covered in [contrib/opendht/README.md](https://github.com/tjjh89017/stunmesh-go/blob/main/contrib/opendht/README.md) — that plugin is the same design as a shell script, and its documentation applies here too.
