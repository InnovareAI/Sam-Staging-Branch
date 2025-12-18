#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=== DATABASE ACCOUNTS (First record to check schema) ==="
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq '.[0] | keys'

echo ""
echo "=== ALL DATABASE ACCOUNTS ==="
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?select=*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -c '.[] | {id, account_name, status, unipile_status}'

echo ""
echo "=== RECENT FAILED QUEUE ERRORS (Last 30) ==="
curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&limit=30&order=updated_at.desc&select=id,error_message,campaign_id,linkedin_account_id,updated_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[] | "\(.updated_at) | \(.error_message)"' | head -20
