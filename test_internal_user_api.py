#!/usr/bin/env python3
import argparse
import base64
import json
import os
import sys
from datetime import datetime, timezone
import urllib.error
import urllib.request

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


def encrypt(data: dict, key: bytes) -> str:
    iv = os.urandom(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    plaintext = json.dumps(data, ensure_ascii=False).encode("utf-8")
    ciphertext = cipher.encrypt(pad(plaintext, AES.block_size))
    return base64.b64encode(iv + ciphertext).decode("utf-8")


def post_json(url: str, payload: dict) -> tuple[int, str]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test /internal/user/register and /internal/user/amount",
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:3000",
        help="Server base URL, e.g. http://127.0.0.1:3000",
    )
    parser.add_argument(
        "--username",
        required=True,
        help="Username used for both register and amount requests",
    )
    parser.add_argument(
        "--secret",
        required=True,
        help="InternalApiSecret value; must be exactly 32 bytes in UTF-8",
    )
    args = parser.parse_args()

    secret = args.secret.encode("utf-8")
    if len(secret) != 32:
        print("error: --secret must be exactly 32 bytes in UTF-8", file=sys.stderr)
        return 1

    base_url = args.base_url.rstrip("/")
    encrypted_payload = encrypt(
        {
            "activation_token": args.username,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        secret,
    )

    print("Encrypted payload:")
    print(encrypted_payload)
    print()

    register_url = f"{base_url}/internal/user/register"
    amount_url = f"{base_url}/internal/user/amount"
    request_body = {"payload": encrypted_payload}

    register_status, register_body = post_json(register_url, request_body)
    print(f"POST {register_url}")
    print(f"HTTP {register_status}")
    print(register_body)
    print()

    amount_status, amount_body = post_json(amount_url, request_body)
    print(f"POST {amount_url}")
    print(f"HTTP {amount_status}")
    print(amount_body)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
