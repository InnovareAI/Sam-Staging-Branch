#!/usr/bin/env python3
"""Check Irish's Unipile account status for any checkpoints"""

import os
import json
import requests
from datetime import datetime

# Get environment variables
UNIPILE_DSN = os.environ.get('UNIPILE_DSN', 'api6.unipile.com:13670')
UNIPILE_API_KEY = os.environ.get('UNIPILE_API_KEY')

if not UNIPILE_API_KEY:
    print("Error: UNIPILE_API_KEY not set")
    exit(1)

# Irish's account ID
ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'

# Make the API request
url = f"https://{UNIPILE_DSN}/api/v1/accounts/{ACCOUNT_ID}"
headers = {
    'X-API-KEY': UNIPILE_API_KEY,
    'Accept': 'application/json'
}

try:
    print(f"Checking account status for Irish (ID: {ACCOUNT_ID})")
    print(f"API URL: {url}")
    print("-" * 80)

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        account_data = response.json()

        # Pretty print the account data
        print("Full Account Response:")
        print(json.dumps(account_data, indent=2))
        print("\n" + "=" * 80 + "\n")

        # Extract key information
        print("KEY STATUS INFORMATION:")
        print("-" * 40)

        # Check for checkpoint
        if 'checkpoint' in account_data:
            print(f"⚠️  CHECKPOINT FOUND: {account_data['checkpoint']}")
            if isinstance(account_data['checkpoint'], dict):
                print("  Checkpoint Details:")
                for key, value in account_data['checkpoint'].items():
                    print(f"    - {key}: {value}")
        else:
            print("✓ No checkpoint field found")

        # Check status
        if 'status' in account_data:
            status = account_data['status']
            print(f"Account Status: {status}")
            if status != 'CONNECTED':
                print(f"  ⚠️  Account is not fully connected!")

        # Check connection status
        if 'connection_status' in account_data:
            print(f"Connection Status: {account_data['connection_status']}")

        # Check if requires action
        if 'requires_action' in account_data:
            print(f"Requires Action: {account_data['requires_action']}")
            if account_data['requires_action']:
                print("  ⚠️  Account requires action!")

        # Check for error
        if 'error' in account_data:
            print(f"⚠️  Error: {account_data['error']}")

        # Check last sync
        if 'last_sync' in account_data:
            print(f"Last Sync: {account_data['last_sync']}")

        # Check provider info
        if 'provider' in account_data:
            print(f"Provider: {account_data['provider']}")

        if 'provider_type' in account_data:
            print(f"Provider Type: {account_data['provider_type']}")

        # Check for any action required fields
        action_fields = ['action_required', 'needs_reconnect', 'is_suspended', 'is_disabled']
        for field in action_fields:
            if field in account_data and account_data[field]:
                print(f"⚠️  {field}: {account_data[field]}")

    else:
        print(f"Error: HTTP {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"Error making API request: {e}")
    import traceback
    traceback.print_exc()