#!/bin/bash

# Test the actual campaigns API endpoint
WORKSPACE_ID="014509ba-226e-43ee-ba58-ab5f20d2ed08"

echo "Testing direct API call to /api/campaigns..."
echo ""

# Make request to the API
curl -s "https://app.meet-sam.com/api/campaigns?workspace_id=${WORKSPACE_ID}" \
  -H "Accept: application/json" | jq '.'

echo ""
echo "If you see campaigns above, the API is working."
echo "If empty, there's a server-side filter issue."
