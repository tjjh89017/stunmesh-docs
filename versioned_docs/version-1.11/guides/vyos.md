---
id: vyos
title: VyOS Site-to-Site
sidebar_position: 1
---

# VyOS Site-to-Site over LTE

Suppose you have two VyOS routers, each with an LTE modem and a SIM card, and you want a WireGuard tunnel between the two sites without a public IP on either end.

**Site A:**
1. VyOS_A with LTE modem and SIM card
2. Other devices under the subnet

**Site B:**
1. VyOS_B with LTE modem and SIM card
2. Other devices under the subnet

stunmesh-go runs as a container on each router (VyOS has built-in container support) and manages the WireGuard endpoint on both sides.

## Steps in Site A

1. Configure VyOS_A with LTE connections.
2. Configure VyOS_A with the following commands.
3. Wait for it to connect (usually within 2 × `refresh_interval`).

```bash
mkdir -p /config/user-data/stunmesh
cat <<EOF > /config/user-data/stunmesh/config.yaml
refresh_interval: "1m"
log:
  level: "debug"
interfaces:
  wg0:
    peers:
      "VYOS_B":
        public_key: "<VYOS_B_PUBLIC_KEY>"
        plugin: cloudflare_main
stun:
  address: "stun.l.google.com:19302"
plugins:
  cloudflare_main:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "<ZONE_NAME>", "-token", "<API_TOKEN>"]
EOF

configure
set container name stunmesh allow-host-networks
set container name stunmesh capability 'net-admin'
set container name stunmesh capability 'net-raw'
set container name stunmesh capability 'net-bind-service'
set container name stunmesh capability 'sys-admin'
set container name stunmesh image 'tjjh89017/stunmesh'
set container name stunmesh uid '0'
set container name stunmesh volume certs destination '/etc/ssl/certs'
set container name stunmesh volume certs mode 'ro'
set container name stunmesh volume certs source '/etc/ssl/certs'
set container name stunmesh volume config destination '/etc/stunmesh'
set container name stunmesh volume config mode 'ro'
set container name stunmesh volume config source '/config/user-data/stunmesh'
set interfaces wireguard wg0 address '192.168.10.1/24'
set interfaces wireguard wg0 port '<YOUR_WIREGUARD_PORT>'
set interfaces wireguard wg0 ip adjust-mss '1380'
set interfaces wireguard wg0 ipv6 adjust-mss '1360'
set interfaces wireguard wg0 mtu '1420'
set interfaces wireguard wg0 peer VYOS_B allowed-ips '192.168.10.2/24'
set interfaces wireguard wg0 peer VYOS_B persistent-keepalive '15'
set interfaces wireguard wg0 peer VYOS_B public-key <VYOS_B_PUBLIC_KEY>
set interfaces wireguard wg0 private-key <VYOS_A_PRIVATE_KEY>

# You will need to setup firewall rules to allow ingress traffic to '<YOUR_WIREGUARD_PORT>'
# Please check the VyOS docs to use nft style firewall or Zone Based Firewall
commit
save
```

## Steps in Site B

Same procedure, mirrored:

```bash
mkdir -p /config/user-data/stunmesh
cat <<EOF > /config/user-data/stunmesh/config.yaml
refresh_interval: "1m"
log:
  level: "debug"
interfaces:
  wg0:
    peers:
      "VYOS_A":
        public_key: "<VYOS_A_PUBLIC_KEY>"
        plugin: cloudflare_main
stun:
  address: "stun.l.google.com:19302"
plugins:
  cloudflare_main:
    type: exec
    command: "/usr/local/bin/stunmesh-cloudflare"
    args: ["-zone", "<ZONE_NAME>", "-token", "<API_TOKEN>"]
EOF

configure
set container name stunmesh allow-host-networks
set container name stunmesh capability 'net-admin'
set container name stunmesh capability 'net-raw'
set container name stunmesh capability 'net-bind-service'
set container name stunmesh capability 'sys-admin'
set container name stunmesh image 'tjjh89017/stunmesh'
set container name stunmesh uid '0'
set container name stunmesh volume certs destination '/etc/ssl/certs'
set container name stunmesh volume certs mode 'ro'
set container name stunmesh volume certs source '/etc/ssl/certs'
set container name stunmesh volume config destination '/etc/stunmesh'
set container name stunmesh volume config mode 'ro'
set container name stunmesh volume config source '/config/user-data/stunmesh'
set interfaces wireguard wg0 address '192.168.10.2/24'
set interfaces wireguard wg0 port '<YOUR_WIREGUARD_PORT>'
set interfaces wireguard wg0 ip adjust-mss '1380'
set interfaces wireguard wg0 ipv6 adjust-mss '1360'
set interfaces wireguard wg0 mtu '1420'
set interfaces wireguard wg0 peer VYOS_A allowed-ips '192.168.10.2/24'
set interfaces wireguard wg0 peer VYOS_A persistent-keepalive '15'
set interfaces wireguard wg0 peer VYOS_A public-key <VYOS_A_PUBLIC_KEY>
set interfaces wireguard wg0 private-key <VYOS_B_PRIVATE_KEY>

# You will need to setup firewall rules to allow ingress traffic to '<YOUR_WIREGUARD_PORT>'
# Please check the VyOS docs to use nft style firewall or Zone Based Firewall
commit
save
```

## Verify

Ping the other side's WireGuard interface IP to test the connection.

## Extra configuration

You may need static or dynamic routes to connect the two sites' subnets — see [Dynamic Routing](dynamic-routing.md).
