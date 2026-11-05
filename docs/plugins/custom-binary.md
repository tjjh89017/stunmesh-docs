---
id: custom-binary
title: Custom Binaries and Go Plugins
sidebar_position: 5
---

# Custom Binaries and Go Plugins

New in v1.16.0. You can build your own stunmesh binary from Go. Pick exactly the built-in plugins you want, and add your own storage plugin. No fork is needed.

Use this when an [exec](exec-protocol.md) or [shell](shell-protocol.md) plugin is not enough: for example, when you want one static binary, or a backend client written in Go.

## How plugins get into a binary

A built-in plugin registers itself from its package's `init()`. It is in the binary only when the binary imports its package. There are no build tags for this.

| Package | Plugin |
|---|---|
| `github.com/tjjh89017/stunmesh-go/builtin/all` | Every shipped built-in |
| `github.com/tjjh89017/stunmesh-go/builtin/cloudflare` | `cloudflare` |
| `github.com/tjjh89017/stunmesh-go/builtin/opendht` | `opendht` |
| `github.com/tjjh89017/stunmesh-go/builtin/trace` | `trace` |
| `github.com/tjjh89017/stunmesh-go/builtin/mirror` | `mirror` |

The `app` package is the daemon itself. It imports no built-in, so your `main` decides the set. To run an embedded WireGuard node instead of the daemon, see [Userspace Node](../reference/userspace.md). A config that names a plugin your binary does not include fails at startup with `builtin plugin not found`.

## A minimal main.go

This is the same shape as the upstream `main.go`, without the command-line flags. It includes `cloudflare`, `trace` and one plugin of your own:

```go title="main.go"
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/tjjh89017/stunmesh-go/app"
	_ "github.com/tjjh89017/stunmesh-go/builtin/cloudflare"
	_ "github.com/tjjh89017/stunmesh-go/builtin/trace"

	_ "example.com/mystunmesh/memstore"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "stunmesh:", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	daemon, err := app.New(app.Options{})
	if err != nil {
		return err
	}
	defer daemon.Close()

	return daemon.Run(ctx)
}
```

`app.Options{}` searches the default config paths. Set `ConfigFile` or `ConfigDir` to choose a config, like the `-c` and `--config-dir` flags do. See [Configuration](../configuration/overview.md).

Start a module and build it:

```bash
go mod init example.com/mystunmesh
go get github.com/tjjh89017/stunmesh-go@v1.17.0
go build -o stunmesh .
```

## Writing a plugin

A plugin implements `pluginapi.Store` and registers a factory:

```go
type Store interface {
	Get(ctx context.Context, req PluginRequest) (string, error)
	Set(ctx context.Context, req PluginRequest) error
}

type PluginRequest struct {
	Device         string // wg interface or tunnel name; "" when unknown
	LocalPublicKey Key    // this host's interface public key
	PeerPublicKey  Key    // the remote peer's public key

	Key   string // storage key, SHA1 hex: the local id on Set, the remote id on Get
	Value string // Set only; empty on Get
}
```

- `Get` returns `("", nil)` or an error when nothing is stored.
- `Key` is a `[32]byte` WireGuard public key. A zero key means unknown. `String()` gives the base64 form.
- The value is an opaque hex string. Store it as is; see [Stored data format](exec-protocol.md#stored-data-format).
- Pass the `ctx` of `Get` and `Set` to every outbound call. It carries the logger and the platform dialer. For HTTP, use `pluginapi/dialer.Transport()` so your plugin escapes a covering tunnel like the built-ins do.
- If the plugin holds connections or goroutines, implement `Close() error`. stunmesh calls it on shutdown.

This plugin keeps values in memory. It is the `memstore` package that the `main.go` above imports:

```go title="memstore/memstore.go"
// Package memstore is an in-memory storage plugin, for tests.
package memstore

import (
	"context"
	"errors"
	"sync"

	"github.com/tjjh89017/stunmesh-go/pluginapi"
)

func init() {
	pluginapi.Register("memstore", New)
}

type config struct {
	Prefix string `mapstructure:"prefix"`
}

type store struct {
	prefix string
	mu     sync.Mutex
	values map[string]string
}

// New must not do network I/O. Open connections in the first Get or Set.
func New(ctx context.Context, raw pluginapi.PluginConfig) (pluginapi.Store, error) {
	var cfg config
	if err := pluginapi.DecodeConfig(ctx, raw, &cfg); err != nil {
		return nil, err
	}
	if cfg.Prefix == "" {
		return nil, errors.New("prefix is required")
	}
	return &store{prefix: cfg.Prefix, values: map[string]string{}}, nil
}

func (s *store) Get(ctx context.Context, req pluginapi.PluginRequest) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.values[s.prefix+req.Key], nil
}

func (s *store) Set(ctx context.Context, req pluginapi.PluginRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.values[s.prefix+req.Key] = req.Value
	return nil
}
```

Use it in the config like any built-in:

```yaml
plugins:
  mem:
    type: builtin
    name: memstore
    prefix: test-
```

### The factory rule

A factory gets a `context.Context` and the instance config. It must not do network I/O: no connections, no DNS lookups, no API calls. Open connections lazily in the first `Get` or `Set`, with that call's context. Local work is fine, such as checking fields or opening a local file.

`pluginapi.Register` and `RegisterWithStores` panic on an empty or duplicate name. Call them from `init()`, or from `main()` before `app.New`.

### Reading config with DecodeConfig

`pluginapi.DecodeConfig(ctx, config, &cfg)` fills a struct from the instance config. The `mapstructure` tags name the YAML keys.

- A value of the wrong type is an error.
- An unknown key logs a warning, so a config written for a newer plugin still loads. Check the log for typos.
- Duration fields accept strings such as `"10s"`.
- The reserved keys `type`, `name` and `dedup` belong to the core. Do not declare them; they never warn.
- Required fields are your job: check them for their zero value after decoding.

### Chaining plugins

Register with `pluginapi.RegisterWithStores` to wrap other instances. The factory then gets a `PluginStores`. Its `Lookup(name)` returns another instance defined under `plugins:`. Read the inner instance names from your own config field; the core reserves none.

- `PluginStores` is valid only during the factory call. Do not keep it.
- The returned `Store` is shared and owned by the core. Do not close it.

Two shipped plugins are the reference examples. Start from them:

- [`builtin/trace`](https://github.com/tjjh89017/stunmesh-go/blob/main/builtin/trace/trace.go): one inner instance (field `next`), and a local file opened in the factory.
- [`builtin/mirror`](https://github.com/tjjh89017/stunmesh-go/blob/main/builtin/mirror/mirror.go): several inner instances (field `stores`).

See [Chaining plugins](overview.md#chaining-plugins) for the config side.

## License

stunmesh-go is licensed under LGPL-3.0-or-later. Go links statically, so a custom binary is not a separate linking of the library. The LGPL exception for separate linking does not apply, and the GPL terms are in effect for the binary you distribute. This makes no difference if your project already uses the same license.
