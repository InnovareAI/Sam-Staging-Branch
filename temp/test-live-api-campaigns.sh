#!/bin/bash

WORKSPACE_ID="014509ba-226e-43ee-ba58-ab5f20d2ed08"

echo "Testing live API endpoint: /api/campaigns"
echo ""

curl -s "https://app.meet-sam.com/api/campaigns?workspace_id=${WORKSPACE_ID}" | jq '.'

echo ""
echo "If you see campaigns above, the API is working correctly."
