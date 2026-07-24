---
id: exec-protocol
title: Exec Plugin Protocol
sidebar_position: 3
---

# Exec Plugin Protocol

The exec plugin communicates with external programs using JSON over stdin/stdout. Your program should:

1. Read a JSON request from stdin
2. Process the request (`get` or `set` action)
3. Write a JSON response to stdout
4. Exit with code 0 for success, non-zero for error

**Request format:**

```json
{
  "action": "get|set",
  "key": "peer_identifier_sha1_hex",
  "value": "encrypted_data_for_set_action"
}
```

**Response format:**

```json
{
  "success": true,
  "value": "encrypted_data_for_get_action",
  "error": "error_message_if_failed"
}
```

## Stored data format

The `value` field contains encrypted endpoint data in hexadecimal format:

1. **Encryption**: the plain endpoint JSON is encrypted using NaCl box (Curve25519 + XSalsa20 + Poly1305), and the result is hex-encoded: `hex(nonce + ciphertext)`, e.g. `"a1b2c3d4e5f6..."`.
2. **Decryption**: the hex string is decoded and the NaCl box decrypts back to plain JSON.

**Decrypted JSON structure:**

```json
{
  "ipv4": "1.2.3.4:51820",
  "ipv6": "[2001:db8::1]:51820"
}
```

Notes:

- Plugins only store/retrieve the hex-encoded string; no encryption or JSON parsing is needed inside the plugin
- Field presence depends on the [interface protocol](../configuration/protocols.md): `ipv4` mode has only the `ipv4` field, `ipv6` mode only `ipv6`, `dualstack` both
- An empty string indicates STUN discovery failed for that protocol
- The `key` field is the SHA-1 hash of the peer identifier, in hex

## Configuration

```yaml
plugins:
  file_storage:
    type: exec
    command: "/usr/local/bin/stunmesh-storage.py"

  redis_storage:
    type: exec
    command: "python3"
    args: ["/usr/local/bin/stunmesh-redis.py"]

  remote_api:
    type: exec
    command: "curl"
    args: ["-s", "-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@-", "https://api.example.com/stunmesh"]
```

## Example: file-based storage (Python)

```python
#!/usr/bin/env python3
import json
import sys
import os

# Simple file-based storage
STORAGE_DIR = "/var/lib/stunmesh"

def ensure_storage_dir():
    os.makedirs(STORAGE_DIR, exist_ok=True)

def get_value(key):
    file_path = os.path.join(STORAGE_DIR, f"{key}.txt")
    try:
        with open(file_path, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return None

def set_value(key, value):
    ensure_storage_dir()
    file_path = os.path.join(STORAGE_DIR, f"{key}.txt")
    with open(file_path, 'w') as f:
        f.write(value)

def main():
    try:
        # Read JSON request from stdin
        request = json.load(sys.stdin)

        action = request.get("action")
        key = request.get("key")

        if action == "get":
            value = get_value(key)
            if value is not None:
                response = {"success": True, "value": value}
            else:
                response = {"success": False, "error": "Key not found"}

        elif action == "set":
            value = request.get("value")
            set_value(key, value)
            response = {"success": True}

        else:
            response = {"success": False, "error": "Unknown action"}

        # Write JSON response to stdout
        json.dump(response, sys.stdout)

    except Exception as e:
        response = {"success": False, "error": str(e)}
        json.dump(response, sys.stdout)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Example: file-based storage (Bash)

```bash
#!/bin/bash

STORAGE_DIR="/var/lib/stunmesh"
mkdir -p "$STORAGE_DIR"

# Read JSON from stdin
INPUT=$(cat)

# Parse JSON using jq
ACTION=$(echo "$INPUT" | jq -r '.action')
KEY=$(echo "$INPUT" | jq -r '.key')

case "$ACTION" in
    "get")
        FILE_PATH="$STORAGE_DIR/${KEY}.txt"
        if [ -f "$FILE_PATH" ]; then
            VALUE=$(cat "$FILE_PATH")
            echo "{\"success\": true, \"value\": \"$VALUE\"}"
        else
            echo "{\"success\": false, \"error\": \"Key not found\"}"
        fi
        ;;
    "set")
        VALUE=$(echo "$INPUT" | jq -r '.value')
        FILE_PATH="$STORAGE_DIR/${KEY}.txt"
        echo "$VALUE" > "$FILE_PATH"
        echo "{\"success\": true}"
        ;;
    *)
        echo "{\"success\": false, \"error\": \"Unknown action\"}"
        exit 1
        ;;
esac
```

## Example: Redis storage (Python)

```python
#!/usr/bin/env python3
import json
import sys
import redis

# Redis connection
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def main():
    try:
        request = json.load(sys.stdin)

        action = request.get("action")
        key = f"stunmesh:{request.get('key')}"

        if action == "get":
            value = r.get(key)
            if value is not None:
                response = {"success": True, "value": value}
            else:
                response = {"success": False, "error": "Key not found"}

        elif action == "set":
            value = request.get("value")
            r.set(key, value)
            # Optional: Set expiration (e.g. 24 hours)
            r.expire(key, 86400)
            response = {"success": True}

        else:
            response = {"success": False, "error": "Unknown action"}

        json.dump(response, sys.stdout)

    except Exception as e:
        response = {"success": False, "error": str(e)}
        json.dump(response, sys.stdout)
        sys.exit(1)

if __name__ == "__main__":
    main()
```
