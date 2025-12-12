#!/bin/bash

API_KEY="39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE="
ACCOUNT_ID="ymtTx4xVQ6OVUFk83ctwtA"
DSN="api6.unipile.com:13670"

echo "Testing Unipile pagination..."

# First request
RESPONSE=$(curl -s -X POST "https://${DSN}/api/v1/linkedin/search?account_id=${ACCOUNT_ID}&limit=10" \
  -H "X-API-KEY: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"api":"sales_navigator","category":"people","keywords":"marketing manager","network_distance":[2]}')

echo "=== Page 1 Full Response ==="
echo "$RESPONSE" | jq '.'
echo ""
echo "=== Page 1 Summary ==="
echo "$RESPONSE" | jq '{items_count: (.items | length), total_count: .paging.total_count, cursor: .paging.cursor}'

CURSOR=$(echo "$RESPONSE" | jq -r '.paging.cursor // empty')

if [ -n "$CURSOR" ]; then
  echo ""
  echo "=== Page 2 (using cursor) ==="
  RESPONSE2=$(curl -s -X POST "https://${DSN}/api/v1/linkedin/search?account_id=${ACCOUNT_ID}&limit=10&cursor=${CURSOR}" \
    -H "X-API-KEY: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{"api":"sales_navigator","category":"people","keywords":"marketing manager","network_distance":[2]}')

  echo "$RESPONSE2" | jq '{items_count: (.items | length), total_count: .paging.total_count, cursor: .paging.cursor}'
else
  echo ""
  echo "NO CURSOR RETURNED - pagination may not be supported for this query"
fi
