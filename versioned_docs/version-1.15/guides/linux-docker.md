---
id: linux-docker
title: Linux with Docker Compose
sidebar_position: 0
---

# Linux to Linux with Docker Compose

This guide builds a WireGuard tunnel between two Linux hosts, **host-a** and **host-b**, from nothing to a working ping. Both hosts sit behind NAT and neither has a public IP. stunmesh-go runs in a container started by Docker Compose.

The split of work is:

- **The host** owns the WireGuard interface `wg0`. You create it with `wg-quick`, exactly as you would without stunmesh-go.
- **The container** runs stunmesh-go with host networking. It sees the host's `wg0`, discovers the public endpoint of its listen port through STUN, publishes that endpoint (encrypted) to a shared store, reads the other host's endpoint back, and sets it on `wg0`.

The shared store in this guide is the built-in [OpenDHT plugin](../plugins/builtin.md#opendht), which needs no account. A [Cloudflare DNS variant](#alternative-cloudflare-dns-instead-of-opendht) is at the end.

Addresses used throughout:

| | host-a | host-b |
|---|---|---|
| Tunnel address | `10.0.0.1/24` | `10.0.0.2/24` |
| WireGuard listen port | `51820` | `51820` |
| Peer name in `config.yaml` | `host-b` | `host-a` |

Every step says which host it runs on. Steps marked **both hosts** are identical on host-a and host-b. All commands run as root (prefix them with `sudo` if you are not root).

## Step 1: Check the network requirements (both hosts)

There is nothing to run in this step. Read it to make sure your two networks can work.

stunmesh-go works through Full Cone, Restricted Cone, and Port Restricted Cone NAT. Symmetric NAT on **both** sides will not work, because the port the STUN server sees is not the port the other peer would reach. At least one host must be behind a cone NAT. See [NAT type support](../intro.md#nat-type-support).

The two hosts must also be behind **different** NATs for this guide as written. Two hosts behind the same router reach each other through that router's public address, which only works if the router supports NAT hairpinning.

## Step 2: Install the prerequisites (both hosts)

You need:

- A Linux kernel with the WireGuard module (in mainline since 5.6; every current distribution kernel has it).
- `wireguard-tools`, for `wg` and `wg-quick` on the host.
- Docker Engine with the Compose plugin (`docker compose`).

On Debian or Ubuntu:

```bash
apt update
apt install -y wireguard-tools
```

For Docker Engine and the Compose plugin, follow the official instructions for your distribution: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/). Then check that everything is in place:

```bash
modprobe wireguard && echo "wireguard module OK"
wg --version
docker --version
docker compose version
```

Pull the stunmesh-go image:

```bash
docker pull ghcr.io/tjjh89017/stunmesh:latest
```

`latest` points at the newest stable release. To pin a version, use a release tag such as `ghcr.io/tjjh89017/stunmesh:v1.15.0` instead, here and in `docker-compose.yaml` below.

## Step 3: Generate WireGuard keys (both hosts)

```bash
mkdir -p /etc/wireguard
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey
cat publickey
```

Copy the printed public key. You need it on the **other** host:

- host-a's `publickey` is `<HOST_A_PUBLIC_KEY>` in host-b's files.
- host-b's `publickey` is `<HOST_B_PUBLIC_KEY>` in host-a's files.

The private keys (`<HOST_A_PRIVATE_KEY>`, `<HOST_B_PRIVATE_KEY>`) never leave their host.

## Step 4: Create the WireGuard interface

In each file, replace `<HOST_A_PRIVATE_KEY>` or `<HOST_B_PRIVATE_KEY>` with the output of `cat /etc/wireguard/privatekey` on that same host, and the public key placeholder with the other host's public key from Step 3.

### host-a: `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = <HOST_A_PRIVATE_KEY>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <HOST_B_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25
```

### host-b: `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = <HOST_B_PRIVATE_KEY>
Address = 10.0.0.2/24
ListenPort = 51820

[Peer]
PublicKey = <HOST_A_PUBLIC_KEY>
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

Three details matter:

- **Pin `ListenPort`.** stunmesh-go reads the listen port once at startup. Without `ListenPort`, the kernel picks a new random port each time the interface comes up.
- **Do not set `Endpoint`.** Neither host knows the other's public address yet. stunmesh-go discovers and sets it.
- **Keep `PersistentKeepalive`.** It keeps the NAT mapping for the WireGuard port open between refreshes.

### Bring it up (both hosts)

```bash
chmod 600 /etc/wireguard/wg0.conf
systemctl enable --now wg-quick@wg0
wg show wg0
```

`wg show` lists the peer with no `endpoint` and no `latest handshake`. That is expected at this point.

### Allow the WireGuard port (both hosts)

If the host runs a firewall, allow inbound UDP on the listen port. For example, with `ufw`:

```bash
ufw allow 51820/udp
```

With `firewalld`:

```bash
firewall-cmd --permanent --add-port=51820/udp
firewall-cmd --reload
```

You do **not** need a port forward on the NAT router. Punching through the NAT is what stunmesh-go does.

## Step 5: Write the stunmesh-go config

Create a directory for the Compose project on each host:

```bash
mkdir -p /opt/stunmesh
```

Both hosts use the same OpenDHT proxies, so both publish into and read from the same store. The peer name (`host-b` or `host-a`) is only a label for the logs.

### host-a: `/opt/stunmesh/config.yaml`

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "host-b":
        public_key: "<HOST_B_PUBLIC_KEY>"
        plugin: dht
stun:
  addresses:
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
plugins:
  dht:
    type: builtin
    name: opendht
    endpoints:
      - https://dhtproxy2.jami.net
      - https://dhtproxy3.jami.net
```

### host-b: `/opt/stunmesh/config.yaml`

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "host-a":
        public_key: "<HOST_A_PUBLIC_KEY>"
        plugin: dht
stun:
  addresses:
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
plugins:
  dht:
    type: builtin
    name: opendht
    endpoints:
      - https://dhtproxy2.jami.net
      - https://dhtproxy3.jami.net
```

The key under `interfaces:` (`wg0`) must match the WireGuard interface name on the host. `public_key` is the **other** host's public key. The full option reference is in [Configuration](../configuration/overview.md).

## Step 6: Write `docker-compose.yaml` (both hosts)

The file is the same on both hosts.

### `/opt/stunmesh/docker-compose.yaml`

```yaml
services:
  stunmesh:
    image: ghcr.io/tjjh89017/stunmesh:latest
    container_name: stunmesh
    restart: unless-stopped
    network_mode: host
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - ./config.yaml:/etc/stunmesh/config.yaml:ro
```

Why each setting is there:

- **`network_mode: host`** — the container must share the host's network namespace. stunmesh-go sends its STUN probe from WireGuard's own listen port and captures the reply with a raw socket, and it configures `wg0` over netlink. Neither works from a separate container network.
- **`NET_ADMIN`** — to read and change the WireGuard device (peer endpoints), and to apply the device's fwmark to the probe socket.
- **`NET_RAW`** — for the raw socket that captures STUN replies on the WireGuard port. These are the same two capabilities as `setcap cap_net_admin,cap_net_raw+ep` for the bare binary in [Getting Started](../getting-started.md#run-stunmesh-go).
- **The config mount** — stunmesh-go reads `/etc/stunmesh/config.yaml` by default.

The image is built `FROM scratch` with an embedded CA bundle, so HTTPS to the OpenDHT proxies (or the Cloudflare API) works without mounting `/etc/ssl/certs`.

:::note

If your environment cannot grant `NET_RAW` (some hardened hosts or restricted container runtimes), Linux can use [proxy mode](../configuration/proxy.md) instead, which needs only `NET_ADMIN`. It is not needed for this guide.

:::

## Step 7: Start stunmesh-go (both hosts)

`wg0` must be up before the container starts. It is, from Step 4.

```bash
cd /opt/stunmesh
docker compose up -d
docker compose logs -f
```

Within a few seconds each host logs lines like these (the order can vary, and each line also carries `device=`, `peer=` and similar fields):

```text
INF daemon started with refresh interval 1m0s
INF discovered IPv4 endpoint ipv4=203.0.113.10:51820
INF store endpoint plugin=dht
INF set data to builtin opendht plugin key=...
INF get data from builtin opendht plugin key=...
```

`discovered IPv4 endpoint` shows the public address and port that STUN found. `store endpoint` followed by no `failed to store endpoint` means the publish succeeded.

The other host's endpoint is read back on each refresh cycle. Until the other host has published, you see:

```text
WRN endpoint is unavailable or not ready
```

This is normal while the second host is still starting. At the `info` log level, a successful read produces no extra line: the `WRN` simply stops appearing, and `wg show` (Step 8) is the proof. With `log.level: "debug"`, each host also logs `selected endpoint` for its peer. Allow about two refresh intervals after the second host starts (roughly two minutes with `refresh_interval: "1m"`). OpenDHT lookups take seconds rather than milliseconds. Press Ctrl-C to stop following the logs; the container keeps running.

## Step 8: Verify the tunnel

On either host:

```bash
wg show wg0
```

The peer now shows an `endpoint` (the other host's public IP and port) and a recent `latest handshake`.

On **host-a**:

```bash
ping -c 4 10.0.0.2
```

On **host-b**:

```bash
ping -c 4 10.0.0.1
```

Replies in both directions mean the tunnel is working.

## Keeping it running

- **Restart the container after changing `wg0`.** stunmesh-go reads the WireGuard device once at startup. After `wg-quick down wg0` / `up wg0`, a listen port change, or an fwmark change, run `docker compose restart` in `/opt/stunmesh`. See [when stunmesh-go must be restarted](../getting-started.md#when-stunmesh-go-must-be-restarted).
- **Restart the container after editing `config.yaml`.** There is no config reload.
- **Boot order.** `restart: unless-stopped` brings the container back after a reboot. Docker can start it before `wg-quick@wg0` has created `wg0`. If that happens, the log shows `failed to register device` for `wg0` and stunmesh-go keeps running without managing it. Run `docker compose restart` once `wg0` exists.
- **Update the image** with `docker compose pull && docker compose up -d`.

## Troubleshooting

**`wg show` has no endpoint after several minutes.**
Check `docker compose logs` on **both** hosts. Each host must log `discovered IPv4 endpoint` and `store endpoint` without a following `failed to store endpoint`. If one host does not, the problem is on that host (STUN discovery or the store). If both publish but `endpoint is unavailable or not ready` keeps repeating, or `failed to decrypt endpoint` appears, check that each `public_key` in `config.yaml` is the **other** host's key and matches `/etc/wireguard/publickey` on that host.

**`failed to discover endpoints`.**
The STUN request got no usable reply. Check that the host can reach the STUN servers over UDP (`stun.l.google.com:19302`), that the container runs with `network_mode: host`, and that it has `NET_RAW`. A host firewall that drops inbound UDP can also drop the STUN reply.

**`failed to register device`, or operation not permitted.**
The container cannot see or change `wg0`. Check that `wg0` exists on the host (`ip link show wg0`), that the interface name in `config.yaml` matches, and that `cap_add` includes `NET_ADMIN`. Restart the container after fixing it.

**`failed to store endpoint` or `endpoint is unavailable or not ready` that never clears.**
The host cannot reach the store. Check outbound HTTPS to the OpenDHT proxies, for example `curl -sI https://dhtproxy2.jami.net`. Listing two proxies, as above, lets the plugin fall back when one is down.

**Endpoint is set, but no handshake.**
The NAT between the hosts does not let the packets through. Common causes: both hosts behind symmetric NAT, both hosts behind the same router without hairpinning, or a host firewall dropping inbound UDP 51820. Set `log.level: "debug"` in `config.yaml` and restart the container for more detail.

**The discovered port differs from `51820`.**
That is normal. The NAT maps the WireGuard port to a public port of its choice, and stunmesh-go publishes the public one.

## Alternative: Cloudflare DNS instead of OpenDHT

If you have a domain on Cloudflare, you can use the built-in Cloudflare plugin as the store instead. Create an API token with DNS edit permission for the zone. Replace the `plugins:` section in **both** `config.yaml` files, and change each peer's `plugin:` to the new name.

### host-a: `/opt/stunmesh/config.yaml`

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "host-b":
        public_key: "<HOST_B_PUBLIC_KEY>"
        plugin: cf
stun:
  addresses:
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
plugins:
  cf:
    type: builtin
    name: cloudflare
    zone: "<YOUR_DOMAIN>"
    token: "<CLOUDFLARE_API_TOKEN>"
    subdomain: "stunmesh"
```

### host-b: `/opt/stunmesh/config.yaml`

```yaml
---
refresh_interval: "1m"
log:
  level: "info"
interfaces:
  wg0:
    peers:
      "host-a":
        public_key: "<HOST_A_PUBLIC_KEY>"
        plugin: cf
stun:
  addresses:
    - "stun.l.google.com:19302"
    - "stun1.l.google.com:19302"
plugins:
  cf:
    type: builtin
    name: cloudflare
    zone: "<YOUR_DOMAIN>"
    token: "<CLOUDFLARE_API_TOKEN>"
    subdomain: "stunmesh"
```

`zone`, `token`, and `subdomain` must be the same on both hosts. The token is used literally; environment variables are not expanded. `docker-compose.yaml` does not change. Restart the container on both hosts after the edit:

```bash
cd /opt/stunmesh
docker compose restart
```

See [Built-in Plugins](../plugins/builtin.md) for all plugin options.

## Next steps

- Route whole subnets behind each host through the tunnel: [Dynamic Routing](dynamic-routing.md).
- Add [ping monitoring](../configuration/ping-monitoring.md) for faster recovery after the NAT mapping changes.
- Use [IPv6 or dual-stack discovery](../configuration/protocols.md).
