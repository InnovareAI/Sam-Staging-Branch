#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"
UNIPILE_KEY="85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA="

echo "========================================="
echo "LINKEDIN ACCOUNT AUDIT"
echo "========================================="
echo ""

echo "=== ALL DATABASE ACCOUNTS ==="
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?select=id,account_name,connection_status,platform,unipile_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[] | "\(.id) | \(.account_name) | \(.platform) | \(.connection_status // "NULL") | \(.unipile_account_id)"'

echo ""
echo "=== UNIPILE API LINKEDIN ACCOUNTS STATUS ==="
curl -s "https://api6.unipile.com:13670/api/v1/accounts" \
  -H "X-API-KEY: ${UNIPILE_KEY}" | jq -r '.items[] | select(.type == "LINKEDIN") | "\(.id) | \(.name) | \(.sources[0].status)"'

echo ""
echo "=== ERROR TYPE BREAKDOWN (Last 2 hours) ==="
curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&order=updated_at.desc&limit=100" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[].error_message' | sort | uniq -c | sort -rn

echo ""
echo "=== SAMPLE FAILED MESSAGES WITH DETAILS ==="
curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&order=updated_at.desc&limit=10&select=error_message,linkedin_user_id,message_type,updated_at,campaign_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -c '.[]'
