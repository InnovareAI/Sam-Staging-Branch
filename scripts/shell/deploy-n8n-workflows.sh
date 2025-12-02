#!/bin/bash

# Deploy N8N CRM Workflows via N8N API
# Reads JSON files and POSTs them to N8N

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Deploying N8N CRM Workflows${NC}"

# Check environment variables
if [ -z "$N8N_API_URL" ]; then
  echo -e "${RED}❌ N8N_API_URL not set${NC}"
  echo "   export N8N_API_URL=https://n8n.innovareai.com"
  exit 1
fi

if [ -z "$N8N_API_KEY" ]; then
  echo -e "${RED}❌ N8N_API_KEY not set${NC}"
  echo "   export N8N_API_KEY=your_api_key"
  exit 1
fi

# Remove trailing slash and /api/v1 if already included
N8N_BASE_URL=$(echo "$N8N_API_URL" | sed 's|/api/v1$||' | sed 's|/$||')
N8N_API="${N8N_BASE_URL}/api/v1"

echo -e "${YELLOW}📡 N8N API: ${N8N_API}${NC}\n"

# ============================================
# Deploy Workflow 1: SAM → CRM
# ============================================

echo -e "${GREEN}📤 Deploying Workflow 1: SAM → CRM${NC}"

WORKFLOW_1_JSON="n8n-workflows/workflow-1-sam-to-crm.json"

if [ ! -f "$WORKFLOW_1_JSON" ]; then
  echo -e "${RED}❌ Workflow file not found: ${WORKFLOW_1_JSON}${NC}"
  exit 1
fi

RESPONSE_1=$(curl -s -X POST "${N8N_API}/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"${WORKFLOW_1_JSON}")

WORKFLOW_1_ID=$(echo "$RESPONSE_1" | jq -r '.id // empty')

if [ ! -z "$WORKFLOW_1_ID" ] && [ "$WORKFLOW_1_ID" != "null" ]; then
  echo -e "${GREEN}✅ Workflow 1 deployed successfully${NC}"
  echo -e "   ID: ${WORKFLOW_1_ID}"
  echo -e "   Webhook: ${N8N_BASE_URL}/webhook/crm-sync-to-crm"
else
  echo -e "${RED}❌ Failed to deploy Workflow 1${NC}"
  echo "$RESPONSE_1" | jq
  exit 1
fi

# ============================================
# Deploy Workflow 2: CRM → SAM
# ============================================

echo -e "\n${GREEN}📤 Deploying Workflow 2: CRM → SAM${NC}"

WORKFLOW_2_JSON="n8n-workflows/workflow-2-crm-to-sam.json"

if [ ! -f "$WORKFLOW_2_JSON" ]; then
  echo -e "${RED}❌ Workflow file not found: ${WORKFLOW_2_JSON}${NC}"
  exit 1
fi

RESPONSE_2=$(curl -s -X POST "${N8N_API}/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"${WORKFLOW_2_JSON}")

WORKFLOW_2_ID=$(echo "$RESPONSE_2" | jq -r '.id // empty')

if [ ! -z "$WORKFLOW_2_ID" ] && [ "$WORKFLOW_2_ID" != "null" ]; then
  echo -e "${GREEN}✅ Workflow 2 deployed successfully${NC}"
  echo -e "   ID: ${WORKFLOW_2_ID}"
  echo -e "   Webhook: ${N8N_BASE_URL}/webhook/crm-sync-from-crm"
else
  echo -e "${RED}❌ Failed to deploy Workflow 2${NC}"
  echo "$RESPONSE_2" | jq
  exit 1
fi

# ============================================
# Summary
# ============================================

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Workflows Deployed Successfully${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}Workflow 1 (SAM → CRM):${NC}"
echo -e "  ID: ${WORKFLOW_1_ID}"
echo -e "  URL: ${N8N_BASE_URL}/webhook/crm-sync-to-crm"

echo -e "\n${YELLOW}Workflow 2 (CRM → SAM):${NC}"
echo -e "  ID: ${WORKFLOW_2_ID}"
echo -e "  URL: ${N8N_BASE_URL}/webhook/crm-sync-from-crm"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Set N8N environment variables in N8N UI:"
echo -e "   - SUPABASE_URL"
echo -e "   - SUPABASE_SERVICE_ROLE_KEY"
echo -e "   - SAM_API_URL"
echo -e "   - N8N_WEBHOOK_SECRET"
echo -e "\n2. Update .env with webhook URLs:"
echo -e "   N8N_WEBHOOK_BASE_URL=${N8N_BASE_URL}"
echo -e "\n3. Test Workflow 1:"
echo -e "   curl -X POST ${N8N_BASE_URL}/webhook/crm-sync-to-crm \\"
echo -e "     -H 'Content-Type: application/json' \\"
echo -e "     -d '{\"workspace_id\":\"test\",\"crm_type\":\"hubspot\",\"action\":\"create\",\"contact_data\":{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john@test.com\"}}'"
echo -e "\n4. Deploy to Netlify:"
echo -e "   git push"

echo -e "\n${GREEN}🎉 CRM Integration Ready!${NC}"
