#!/bin/bash
# Upload N8N Workflow via API

set -e

source /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local

N8N_URL="${N8N_API_BASE_URL:-$N8N_INSTANCE_URL}"
WORKFLOW_FILE="/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-workflows/campaign-execute.json"

echo "🔧 Uploading N8N Workflow"
echo "=========================="
echo ""
echo "N8N URL: $N8N_URL"
echo "API Key: ${N8N_API_KEY:0:20}..."
echo ""

# Try to create the workflow
echo "📡 Creating workflow..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$WORKFLOW_FILE")

HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
  echo "✅ Workflow created successfully!"
  echo ""
  echo "$BODY" | jq '.'
elif [ "$HTTP_STATUS" -eq 401 ]; then
  echo "❌ Authentication failed (401)"
  echo ""
  echo "The API key doesn't have permission to create workflows."
  echo "You need to:"
  echo "  1. Go to: https://innovareai.app.n8n.cloud"
  echo "  2. Click 'Workflows' → 'Add workflow'"
  echo "  3. Click the 3-dot menu → 'Import from file'"
  echo "  4. Select: $WORKFLOW_FILE"
  echo ""
else
  echo "❌ Failed to create workflow (HTTP $HTTP_STATUS)"
  echo ""
  echo "$BODY"
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Manual Import Instructions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If API upload fails, import manually:"
echo ""
echo "1. Go to: https://innovareai.app.n8n.cloud"
echo "2. Click: Workflows → Add workflow"
echo "3. Click: ⋯ (menu) → Import from file"
echo "4. Select: $WORKFLOW_FILE"
echo "5. Click: Activate workflow (toggle in top right)"
echo ""
echo "6. Set environment variables in N8N:"
echo "   Settings → Variables"
echo "   "
echo "   Required variables:"
echo "   - UNIPILE_DSN: ${UNIPILE_DSN}"
echo "   - UNIPILE_API_KEY: ${UNIPILE_API_KEY:0:30}..."
echo "   - NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo "   - SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:30}..."
echo ""
