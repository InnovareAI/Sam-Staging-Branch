#!/bin/bash

# Test fixing one prospect name
LINKEDIN_USERNAME="benroodman"
UNIPILE_ACCOUNT_ID="mERQmojtSZq5GeomZZazlw"

echo "🔍 Fetching profile for: $LINKEDIN_USERNAME"

# Fetch from Unipile
RESPONSE=$(curl -s "https://${UNIPILE_DSN}/api/v1/users/${LINKEDIN_USERNAME}?account_id=${UNIPILE_ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}")

echo "Response:"
echo "$RESPONSE" | jq '.'

# Extract display_name
DISPLAY_NAME=$(echo "$RESPONSE" | jq -r '.display_name')
echo ""
echo "Display Name: $DISPLAY_NAME"

# Parse into first/last
FIRST_NAME=$(echo "$DISPLAY_NAME" | awk '{print $1}')
LAST_NAME=$(echo "$DISPLAY_NAME" | awk '{$1=""; print $0}' | xargs)

echo "First Name: $FIRST_NAME"
echo "Last Name: $LAST_NAME"
