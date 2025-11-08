#!/bin/bash

# Cleanup all old test campaigns from Campaign Creator
# This will delete all approval sessions and prospect data for your workspace

WORKSPACE_ID="babdcab8-1a78-4b2f-913e-6e9fd9821009"

echo "🧹 Cleaning up Campaign Creator for workspace: $WORKSPACE_ID"
echo ""

RESULT=$(curl -s -X POST "https://app.meet-sam.com/api/admin/cleanup-campaign-creator" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\": \"$WORKSPACE_ID\"}")

echo "$RESULT" | jq '.'

# Extract deletion counts
SESSIONS_DELETED=$(echo "$RESULT" | jq -r '.deleted.sessions // 0')
PROSPECTS_DELETED=$(echo "$RESULT" | jq -r '.deleted.prospects // 0')

echo ""
echo "✅ Cleanup complete!"
echo "   Deleted $SESSIONS_DELETED campaign sessions"
echo "   Deleted $PROSPECTS_DELETED prospect records"
echo ""
echo "Refresh your Campaign Creator tab to see the empty state."
