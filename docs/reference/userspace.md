---
id: userspace
title: Userspace Node (Go API)
sidebar_position: 3
---

# Userspace Node (Go API)

New in v1.17.0. The Go package `github.com/tjjh89017/stunmesh-go/userspace` runs a STUNMESH node entirely in userspace. It embeds a wireguard-go device on a tun that you provide. It does the same STUN discovery, encrypted endpoint publishing and peer establishment as the stunmesh daemon, so a userspace node and a daemon peer interoperate.

:::warning Experimental
The `userspace` package is experimental. Its API and the config JSON shape may change in a minor release.
:::

Use it when you want a WireGuard node inside your own Go program, without a kernel WireGuard interface and without the daemon. The [stunmesh-android](https://github.com/tjjh89017/stunmesh-android) app uses the same core through the gomobile binding.

How it differs from the [`app` package](../plugins/custom-binary.md):

| | `app` | `userspace` |
|---|---|---|
| WireGuard | An existing interface (kernel, or wireguard-go over UAPI) | An embedded wireguard-go device |
| tun | Owned by the system | Opened by your tun factory |
| Config | The YAML config file | A `userspace.Config` value or JSON |
| Controllers | The daemon controllers, ping monitor and refresh ticker | A built-in discover, publish and establish cycle |

The package has no build tag. It builds on every platform that the main binary supports.

## Plugins

Like `app`, `userspace` registers no built-in plugin. Blank-import the plugins your config names:

```go
import _ "github.com/tjjh89017/stunmesh-go/builtin/all"
```

Or import only the `builtin/*` packages you want, or your own plugin. See [How plugins get into a binary](../plugins/custom-binary.md#how-plugins-get-into-a-binary).

## Creating a node

```go
func New(cfg *Config, newTun func(mtu int) (tun.Device, error), opts Options) (*Node, error)
```

- `New` validates `cfg` and copies it. Later changes to `cfg` have no effect. No socket or device is created until `Start`.
- `newTun` opens the tun for the device, sized to `mtu`. `Start` calls it once per start. `Stop` closes the tun it returned. A node can start again after `Stop` when `newTun` can open a fresh tun each time.
- `tun.Device` is `golang.zx2c4.com/wireguard/tun.Device`.
- `userspace.ParseConfig(data []byte)` decodes a JSON config and validates it like `New` does.

`Options` has three fields. All are optional.

| Field | Type | Nil means |
|---|---|---|
| `Protector` | `SocketProtector` | No-op. Otherwise `Protect(fd int32) bool` is called for each outer UDP socket, to exclude it from the tunnel (for example `VpnService.protect` on Android). |
| `DNSServers` | `func() []string` | The system resolver configuration. Otherwise it returns the nameservers that plugin and STUN lookups use, as `host` or `host:port` IP literals. An empty result also uses the system resolver. |
| `Listener` | `EventListener` | Events are dropped. |

## Node methods

| Method | Description |
|---|---|
| `Start() error` | Opens the tun, brings the device up and starts the STUNMESH cycle. Fails when the node is already running. |
| `Stop()` | Stops the cycle and closes the device, sockets and tun. Safe to call more than once. |
| `IsRunning() bool` | Reports whether the device is up. |
| `SetPeerEndpoint(publicKeyB64, endpoint string) error` | Sets one peer's endpoint (`host:port`) without a device restart. The cycle overwrites it when the peer publishes a different one. |
| `SetPeerKeepalive(publicKeyB64 string, seconds int) error` | Sets one peer's persistent keepalive, `0` (off) to `65535` seconds, without a device restart. |
| `Status() (Status, error)` | Reports the live device state. |

`SetPeerEndpoint`, `SetPeerKeepalive` and `Status` return an error when the node is not running. `SetPeerEndpoint` and `SetPeerKeepalive` return an error that wraps `userspace.ErrUnknownPeer` for a public key that is not in `Config.Peers`. Check it with `errors.Is`.

## Status

`Status` holds no private key.

| Field | Description |
|---|---|
| `ListenPort` | The UDP port the device listens on. |
| `Peers` | One `PeerStatus` per peer, in config order. |

`PeerStatus` fields:

| Field | Description |
|---|---|
| `PublicKey` | The peer's public key, base64. |
| `Endpoint` | The current `host:port`. Empty when the peer has none. |
| `LastHandshake` | `time.Time` of the last handshake. Zero when none completed. |
| `Keepalive` | Persistent keepalive in seconds. `0` when off. |
| `RxBytes`, `TxBytes` | Bytes received and sent. |

## Events

An `EventListener` has three methods. The node calls them from its own goroutines.

| Method | Description |
|---|---|
| `OnStateChanged(state string)` | One of `StateDown`, `StateStarting`, `StateUp`, `StateStopping` (`"down"`, `"starting"`, `"up"`, `"stopping"`). |
| `OnLog(level, message string)` | One log line. `level` is `debug`, `info`, `warn` or `error`. |
| `OnEvent(kind, peerPublicKey, detail string)` | A STUNMESH event. `peerPublicKey` may be empty. |

Event kinds include:

| `kind` | `detail` |
|---|---|
| `endpoint_discovered` | The family and the discovered public endpoint. |
| `publish_ok` | The storage key that was written. |
| `peer_endpoint_updated` | The new endpoint. |
| `peer_keepalive_updated` | The new keepalive interval in seconds. |

`peer_endpoint_updated` and `peer_keepalive_updated` are sent after a successful `SetPeerEndpoint` or `SetPeerKeepalive`, and when the cycle applies an endpoint. A refused call sends no event.

## Config

`userspace.Config` is one tunnel. Its JSON shape is the one the Android app writes. Field names follow the [YAML config](../configuration/overview.md) where one exists.

```json
{
  "name": "wg0",
  "interface": {
    "private_key": "<BASE64_PRIVATE_KEY>",
    "addresses": ["10.0.0.2/24"],
    "dns_servers": [],
    "listen_port": 0,
    "mtu": 1420,
    "protocol": "ipv4"
  },
  "peers": [
    {
      "name": "home",
      "public_key": "<BASE64_PEER_PUBLIC_KEY>",
      "allowed_ips": ["10.0.0.1/32"],
      "plugin": "dht",
      "protocol": "ipv4",
      "persistent_keepalive": 25
    }
  ],
  "plugins": [
    {
      "instance": "dht",
      "type": "builtin",
      "name": "opendht",
      "config": {"endpoint": "<OPENDHT_PROXY_URL>"}
    }
  ],
  "stun": {"addresses": ["stun.l.google.com:19302"]},
  "refresh_interval_seconds": 600,
  "log": {"level": "error"}
}
```

- `interface.private_key` is required. Keys are base64, 32 bytes.
- `interface.listen_port`: `0` lets the system pick a port. Read it back from `Status().ListenPort`.
- `interface.mtu` defaults to `1420`. `interface.protocol` defaults to `ipv4`; see [Protocols](../configuration/protocols.md).
- `interface.addresses` and `interface.dns_servers` are not applied by the node. You own the tun, so you assign its addresses and DNS. The fields only carry the values for you.
- Each peer also accepts `description`, `preshared_key` and `endpoint` (an initial `host:port`). Peer `protocol` takes `ipv4`, `ipv6`, `prefer_ipv4` or `prefer_ipv6`.
- `plugins`: `instance` is the name a peer's `plugin` refers to. `type` and `name` mean the same as under `plugins:` in the YAML config. `config` holds the plugin's own keys.
- `stun.addresses` defaults to `stun.l.google.com:19302`. `refresh_interval_seconds` defaults to `600`.
- `log.level` sets the wireguard-go log: `debug` or `trace` is verbose, `silent` or `disabled` is off, anything else logs errors only.

## Example

This program runs a node on a Linux tun. It needs `CAP_NET_ADMIN`. Assign the address to the tun yourself, for example with `ip addr add 10.0.0.2/24 dev stunmesh0 && ip link set stunmesh0 up` after `Start`.

```go title="main.go"
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/tjjh89017/stunmesh-go/builtin/all"
	"github.com/tjjh89017/stunmesh-go/userspace"
	"golang.zx2c4.com/wireguard/tun"
)

type logListener struct{}

func (logListener) OnStateChanged(state string)    { log.Println("state:", state) }
func (logListener) OnLog(level, msg string)        { log.Println(level, msg) }
func (logListener) OnEvent(kind, peer, det string) { log.Println("event:", kind, peer, det) }

func main() {
	data, err := os.ReadFile("node.json")
	if err != nil {
		log.Fatal(err)
	}
	cfg, err := userspace.ParseConfig(data)
	if err != nil {
		log.Fatal(err)
	}

	newTun := func(mtu int) (tun.Device, error) {
		return tun.CreateTUN("stunmesh0", mtu)
	}
	node, err := userspace.New(cfg, newTun, userspace.Options{Listener: logListener{}})
	if err != nil {
		log.Fatal(err)
	}
	if err := node.Start(); err != nil {
		log.Fatal(err)
	}
	defer node.Stop()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
}
```

Add the module:

```bash
go get github.com/tjjh89017/stunmesh-go@v1.17.0
```

## Platform notes

- STUN shares the WireGuard UDP socket. The node needs no raw socket and no pcap.
- On Windows, the node's UDP sockets turn off `SIO_UDP_CONNRESET`. Without that, an ICMP port unreachable for an earlier send, such as a STUN probe to a closed port, could fail a later receive and stop the device.

## Mobile binding

The gomobile binding in `mobile/` (build tag `mobile`) is a thin wrapper over `userspace`. It imports `builtin/all`, and it adds what only a platform VPN service needs:

- `TunProvider`: `OpenTun(mtu int32) int32` returns a detached tun fd from the VPN service.
- `RenewTun(fd int32)`: swaps in a fresh tun fd after a network change, without a device restart.
- `SetDNSServers`: the nameservers for plugin lookups. Until the app sets them, public resolvers are used, because Android has no `resolv.conf`.

Its `NewNode` takes the config as a JSON string, in the shape shown above.
