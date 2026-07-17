---
id: shell-protocol
title: Shell Plugin Protocol
sidebar_position: 4
---

# Shell Plugin Protocol

The shell plugin provides a simpler alternative for shell scripts, using shell variable assignments instead of JSON.

**Input format (stdin):**

```bash
STUNMESH_ACTION=get
STUNMESH_KEY=3061b8fcbdb6972059518f1adc3590dca6a5f352  # SHA-1 hash of peer identifier (hex)
STUNMESH_VALUE=a1b2c3d4e5f6...  # Hex-encoded encrypted endpoint data (for "set" only)
```

**Output:**

- For `get`: write the hex-encoded value to stdout
- For `set`: exit with code 0 for success
- For errors: exit with a non-zero code, error message on stderr

Notes:

- Both `STUNMESH_KEY` and `STUNMESH_VALUE` are hex strings (no special characters)
- The value format is identical to the [exec plugin](exec-protocol.md#stored-data-format) (hex-encoded encrypted JSON)
- No escaping or quoting needed — safe to use with `source /dev/stdin` or `eval`

## Configuration

```yaml
plugins:
  cf_shell:
    type: shell
    command: "/usr/local/bin/cloudflare-storage.sh"
```

## Example: Cloudflare DNS storage

```bash
#!/bin/bash
source /dev/stdin

ZONE_ID="your-zone-id"
API_TOKEN="your-api-token"
SUBDOMAIN="wg"

case "$STUNMESH_ACTION" in
    get)
        # Get TXT record from Cloudflare
        # Record name format: <key>.<subdomain>.example.com
        RECORD_NAME="${STUNMESH_KEY}.${SUBDOMAIN}.example.com"
        VALUE=$(curl -s -X GET \
            "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=$RECORD_NAME" \
            -H "Authorization: Bearer $API_TOKEN" | \
            jq -r '.result[0].content' 2>/dev/null)

        if [ "$VALUE" != "null" ] && [ -n "$VALUE" ]; then
            echo "$VALUE"
        else
            echo "Record not found" >&2
            exit 1
        fi
        ;;
    set)
        # Create/update TXT record in Cloudflare
        RECORD_NAME="${STUNMESH_KEY}.${SUBDOMAIN}.example.com"
        curl -s -X POST \
            "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"TXT\",\"name\":\"$RECORD_NAME\",\"content\":\"$STUNMESH_VALUE\",\"ttl\":120}" \
            >/dev/null
        ;;
esac
```
