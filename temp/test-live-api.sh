#!/bin/bash

echo "🔍 Testing live sessions/list API..."
echo ""

# Test with workspace_id parameter
echo "1. Testing WITH workspace_id parameter:"
curl -s "https://app.meet-sam.com/api/prospect-approval/sessions/list?workspace_id=babdcab8-1a78-4b2f-913e-6e9fd9821009" \
  -H "Cookie: ${COOKIE}" \
  | jq '.'

echo ""
echo "2. Testing WITHOUT workspace_id parameter:"
curl -s "https://app.meet-sam.com/api/prospect-approval/sessions/list" \
  -H "Cookie: ${COOKIE}" \
  | jq '.'
