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

The built binary reports its version with `--version` — the tag when built at one, a pseudo-version otherwise (the Go toolchain stamps it from the git metadata; no build flags needed).

## Build options

**Binary minimization:**

| Variable | Default | Effect |
|---|---|---|
| `STRIP=1` | on | Strip debug symbols (`-s -w`, ~30% smaller). Panic traces and pprof still work; set `STRIP=0` for a binary delve/gdb can debug |
| `TRIMPATH=1` | on | Remove file system paths from the binary (reproducible builds) |
| `UPX=1` | off | Compress the binary with UPX (requires `upx` to be installed) |
| `EXTRA_MIN=1` | off | All of the above (STRIP + TRIMPATH + UPX) |

:::note

UPX-packed binaries decompress wholesale into RAM at exec and cannot be demand-paged. On embedded targets with a compressed filesystem (JFFS2, squashfs) the plain binary is already compressed on flash and still served through the page cache — prefer that over UPX there.

:::

**Embedded CA bundle:**

| Variable | Default | Effect |
|---|---|---|
| `EMBED_CA=1` | off | Embed the Mozilla root CA bundle (build tag `embedca`, ~160KB). Used **only** when the system provides no certificate store, so HTTPS plugins work on minimal images (OpenWrt before 21.02, bare buildroot) without a ca-certificates package |

### Built-in plugin options

| Variable | Effect |
|---|---|
| `BUILTIN=all` | (Default) Compile with all available built-in plugins (cloudflare, opendht) |
| `BUILTIN=` | Build without any built-in plugins (minimal binary) |
| `BUILTIN=builtin_cloudflare` | Compile with the Cloudflare built-in only |
| `BUILTIN="builtin_cloudflare builtin_opendht"` | Multiple plugins (quotes required, space-separated) |

**Examples:**

```bash
# Normal build (stripped, trimpath, all built-in plugins)
make build

# Debuggable binary (keep symbols and DWARF)
make build STRIP=0

# Build without any built-in plugins (minimal binary)
make build BUILTIN=

# Self-contained HTTPS for images without ca-certificates
make build EMBED_CA=1

# Minimal binary without built-in plugins
make all BUILTIN=

# Specific built-in plugin only
make all BUILTIN=builtin_cloudflare
```

**Platform notes:**

- CGO is disabled for all default builds, on every platform (produces static binaries). See [Backend Selection](#backend-selection) for the one case that needs it.

**Release binaries:**

- **Linux**: `stunmesh-linux-<arch>-<tag>`, plus a `-ca` variant (`stunmesh-linux-<arch>-ca-<tag>`) built with `EMBED_CA=1` for images without a CA store
- **macOS, FreeBSD**: normal binaries only
- **Windows**: shipped as `stunmesh-windows-<arch>-<tag>.zip`

## Contrib plugins

```bash
make plugin    # or: make contrib
```

Builds all standalone plugins under `contrib/` (Cloudflare DNS, OpenDHT, and their shell-script variants). See [Storage Plugins](../plugins/overview.md#contrib-plugins).

## Backend selection

stunmesh-go supports two WireGuard backends:

- `wgctrl`: uses [`wgctrl-go`](https://github.com/WireGuard/wgctrl-go) to talk to the kernel WireGuard interface directly. Requires CGO on FreeBSD.
- `wgcli`: shells out to the `wg` command-line tool. Builds with `CGO_ENABLED=0` on all platforms.

Each platform selects its own default, so a plain `make build` or `go build` needs no configuration:

| Platform | Default backend | CGO |
| --- | --- | --- |
| Linux, macOS, Windows | `wgctrl` | disabled |
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
