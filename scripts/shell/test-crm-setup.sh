#!/bin/bash

# Simple CRM Setup Test Script
# Tests Postgres connection and N8N webhook endpoints

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧪 Testing CRM Setup"

# 1. Test Supabase Postgres connection
echo -e "\n${GREEN}1. Testing Supabase connection...${NC}"
psql "${SUPABASE_DATABASE_URL}" -c "SELECT COUNT(*) FROM crm_connections;" || echo -e "${RED}❌ Supabase connection failed${NC}"

# 2. Test N8N webhook (SAM → CRM)
echo -e "\n${GREEN}2. Testing N8N webhook (SAM → CRM)...${NC}"
curl -X POST "${N8N_WEBHOOK_BASE_URL}/webhook/crm-sync-to-crm" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "test",
    "crm_type": "hubspot",
    "action": "create",
    "contact_data": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com"
    }
  }'

# 3. Test SAM webhook endpoint
echo -e "\n${GREEN}3. Testing SAM webhook endpoint...${NC}"
curl -X POST "${SAM_API_URL}/api/crm/webhook/sync-complete" \
  -H "Content-Type: application/json" \
  -H "x-n8n-webhook-secret: ${N8N_WEBHOOK_SECRET}" \
  -d '{
    "workspace_id": "test",
    "entity_type": "contact",
    "entity_id": "test-id",
    "crm_type": "hubspot",
    "status": "success",
    "crm_record_id": "123",
    "synced_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

echo -e "\n${GREEN}✅ Tests complete${NC}"
