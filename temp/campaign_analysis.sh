#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "========================================="
echo "TOP 3 ERROR CAMPAIGNS ANALYSIS"
echo "========================================="
echo ""

# Campaign 1: Consulting- Sequence B (33 errors)
echo "=== CAMPAIGN 1: Consulting- Sequence B ==="
echo "Campaign ID: 9904dfec-03dd-4ea7-be70-8db55cb3c261"
echo "LinkedIn Account ID: f9c8a97a-d0ca-4b5c-98a8-8965a5c8475c"
echo ""
echo "Account Details:"
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?id=eq.f9c8a97a-d0ca-4b5c-98a8-8965a5c8475c" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0] | "Name: \(.account_name)\nUnipile ID: \(.unipile_account_id)\nStatus: \(.connection_status)\nPlatform: \(.platform)"'
echo ""

# Campaign 2: (19 errors)
echo "=== CAMPAIGN 2: 22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd ==="
curl -s "${SUPABASE_URL}/rest/v1/campaigns?id=eq.22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd&select=name,linkedin_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0] | "Campaign: \(.name)\nAccount ID: \(.linkedin_account_id)"'
echo ""
ACCOUNT_ID=$(curl -s "${SUPABASE_URL}/rest/v1/campaigns?id=eq.22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd&select=linkedin_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0].linkedin_account_id')
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?id=eq.${ACCOUNT_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0] | "Name: \(.account_name)\nUnipile ID: \(.unipile_account_id)\nStatus: \(.connection_status)"'
echo ""

# Campaign 3: (10 errors)  
echo "=== CAMPAIGN 3: 987dec20-b23d-465f-a8c7-0b9e8bac4f24 ==="
curl -s "${SUPABASE_URL}/rest/v1/campaigns?id=eq.987dec20-b23d-465f-a8c7-0b9e8bac4f24&select=name,linkedin_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0] | "Campaign: \(.name)\nAccount ID: \(.linkedin_account_id)"'
echo ""
ACCOUNT_ID=$(curl -s "${SUPABASE_URL}/rest/v1/campaigns?id=eq.987dec20-b23d-465f-a8c7-0b9e8bac4f24&select=linkedin_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0].linkedin_account_id')
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?id=eq.${ACCOUNT_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0] | "Name: \(.account_name)\nUnipile ID: \(.unipile_account_id)\nStatus: \(.connection_status)"'

echo ""
echo "=== ERROR BREAKDOWN BY TYPE ==="
echo ""
echo "1. Invalid User ID Format (53 errors):"
echo "   - Caused by linkedin_user_id containing URLs or public identifiers"
echo "   - Examples: 'micreid', 'http://www.linkedin.com/in/...'"
echo "   - Should be: LinkedIn entity URNs like 'ACoAAA...'"
echo ""
echo "2. Profile Not Found (30 errors):"
echo "   - LinkedIn profile not found or inaccessible"
echo ""
echo "3. API Endpoint Not Found (10 errors):"
echo "   - 'Cannot POST /api/v1/messages/send' - endpoint issue"
echo ""
echo "4. Rate Limiting (2 errors):"
echo "   - Too many requests to LinkedIn"
