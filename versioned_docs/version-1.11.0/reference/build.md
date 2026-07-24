---
id: build
title: Building from Source
sidebar_position: 1
---

# Building from Source

```bash
make all
```

:::note

On FreeBSD and macOS, use GNU Make (`gmake`) to build.

:::

A direct `go build -o stunmesh-go` also works and picks the same per-platform defaults.

## Build options

**Binary minimization:**

| Variable | Effect |
|---|---|
| `STRIP=1` | Strip debug symbols from the binary (reduces size) |
| `TRIMPATH=1` | Remove file system paths from the binary (improves reproducibility) |
| `UPX=1` | Compress the binary with UPX (requires `upx` to be installed) |
| `EXTRA_MIN=1` | All of the above (STRIP + TRIMPATH + UPX) |

### Built-in plugin options

| Variable | Effect |
|---|---|
| `BUILTIN=all` | (Default) Compile with all available built-in plugins (cloudflare, opendht) |
| `BUILTIN=` | Build without any built-in plugins (minimal binary) |
| `BUILTIN=builtin_cloudflare` | Compile with the Cloudflare built-in only |
| `BUILTIN="builtin_cloudflare builtin_opendht"` | Multiple plugins (quotes required, space-separated) |

**Examples:**

```bash
# Normal build (includes all built-in plugins by default)
make build

# Build without any built-in plugins (minimal binary)
make build BUILTIN=

# Build with stripped symbols
make build STRIP=1

# Build with all minimizations (strip, trimpath, and UPX compression)
make build EXTRA_MIN=1

# Clean and build with extra minimization
make all EXTRA_MIN=1

# Build minimal binary without built-in plugins
make all BUILTIN= EXTRA_MIN=1

# Build with specific built-in plugin only
make all BUILTIN=builtin_cloudflare EXTRA_MIN=1
```

**Platform notes:**

- CGO is disabled for all default builds, on every platform (produces static binaries). See [Backend Selection](#backend-selection) for the one case that needs it.
- UPX compression significantly reduces binary size but requires the `upx` tool.

**Release binaries:**

- **Linux**: both normal and `-upx` suffixed binaries are provided (built with `EXTRA_MIN=1`)
- **macOS**: normal binaries only
- **FreeBSD**: normal binaries only

## Contrib plugins

```bash
make plugin    # or: make contrib
```

Builds all standalone plugins under `contrib/` (Cloudflare DNS, OpenDHT). See [Storage Plugins](../plugins/overview.md#contrib-plugins).

## Backend selection

stunmesh-go supports two WireGuard backends:

- `wgctrl`: uses [`wgctrl-go`](https://github.com/WireGuard/wgctrl-go) to talk to the kernel WireGuard interface directly. Requires CGO on FreeBSD.
- `wgcli`: shells out to the `wg` command-line tool. Builds with `CGO_ENABLED=0` on all platforms.

Each platform selects its own default, so a plain `make build` or `go build` needs no configuration:

| Platform | Default backend | CGO |
| --- | --- | --- |
| Linux, macOS | `wgctrl` | disabled |
| FreeBSD | `wgcli` | disabled |

FreeBSD defaults to `wgcli` because its `wgctrl` support requires CGO, which cannot be cross-compiled without a sysroot. Every released binary is therefore `CGO_ENABLED=0`.

**Runtime requirement on FreeBSD:** because the default backend is `wgcli`, the `wg` command must be installed and available in `PATH`:

```console
# pkg install wireguard-tools
```

On Linux and macOS the default needs no such tool: `wgctrl` speaks netlink on Linux and the userspace wireguard-go socket protocol on macOS, both in pure Go. There is no reason to select `wgcli` on those platforms, and it is neither tested nor supported there.

**Overriding the default** with the `BACKEND` variable:

```bash
make build BACKEND=wgctrl    # force wgctrl; on FreeBSD this needs CGO and a native toolchain
```

Building `BACKEND=wgctrl` on FreeBSD must be done natively (`gmake BACKEND=wgctrl`) — it cannot be cross-compiled from Linux, and it is not part of any release.

If you build directly with `go build` instead of `make`, the same defaults apply; override with `-tags wgctrl`.
