---
id: dynamic-routing
title: Dynamic Routing (OSPF / VRF)
sidebar_position: 3
---

# Dynamic Routing

You can run OSPF over the WireGuard interfaces to create a full-mesh site-to-site VPN with dynamic routing — no static routes to maintain.

## OSPF over WireGuard

WireGuard interfaces have no link status (up/down), so OSPF's periodic hellos double as the liveness check for the tunnel. Practical notes:

- OSPF says hello to the remote peer periodically, which effectively checks whether the tunnel is passing traffic.
- Reduce the hello and dead intervals for faster failure response.
- **Set up an access list or route map to prevent redistributing public IPs to remote peers.** Otherwise a peer may learn a route to the other side's underlay endpoint *through the tunnel*, and fail to reach it once the tunnel flaps — especially in multi-node meshes.

BGP, by contrast, only updates when the route table changes, so it takes longer to detect a dead link. BFD with BGP is not recommended at small scale — the overhead outweighs the faster detection.

## VRF

If the WireGuard underlay shares the box with a public network, consider putting the WireGuard interface in a VRF. When the private network needs internet access, use VRF route leaking to install a second default route to the internet.

## EdgeRouter example

WireGuard interface:

```text
    wireguard wg03 {
        address <some route peer to peer IP>/30
        description "to lab"
        ip {
            ospf {
                network point-to-point
            }
        }
        listen-port <wg port>
        mtu 1420
        peer <Remote Peer Public Key> {
            allowed-ips 0.0.0.0/0
            allowed-ips 224.0.0.5/32
            persistent-keepalive 15
        }
        private-key ****************
        route-allowed-ips false
    }
```

OSPF with an access list that only exports the LAN:

```text
policy {
    access-list 1 {
        description OSPF
        rule 1 {
            action permit
            source {
                inverse-mask 0.0.0.255
                network <Your LAN CIDR>
            }
        }
        rule 99 {
            action deny
            source {
                any
            }
        }
    }
}

protocols {
    ospf {
        access-list 1 {
            export connected
        }
        area 0.0.0.0 {
            network <Your network CIDR>
        }
        parameters {
            abr-type cisco
            router-id <Router ID>
        }
        passive-interface default
        passive-interface-exclude <Your WG interface>
        redistribute {
            connected {
                metric-type 2
            }
        }
    }
}
```
