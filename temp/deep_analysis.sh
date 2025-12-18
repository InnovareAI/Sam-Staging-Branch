#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=== MARTIN SCHECHTNER ACCOUNT CHECK ==="
curl -s "${SUPABASE_URL}/rest/v1/user_unipile_accounts?account_name=like.*Schechtner*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq '.'

echo ""
echo "=== CAMPAIGNS WITH MOST ERRORS ==="
curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&limit=100" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[].campaign_id' | sort | uniq -c | sort -rn | head -10

echo ""
echo "=== TOP ERROR CAMPAIGN DETAILS ==="
# Get the campaign ID with most errors
CAMPAIGN_ID=$(curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&limit=100" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[].campaign_id' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')

echo "Campaign ID: $CAMPAIGN_ID"
curl -s "${SUPABASE_URL}/rest/v1/campaigns?id=eq.${CAMPAIGN_ID}&select=id,name,campaign_type,linkedin_account_id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq '.'

echo ""
echo "=== LINKEDIN USER ID FORMAT ISSUES ==="
echo "Examples of problematic linkedin_user_id values:"
curl -s "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed&limit=20" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[] | select(.error_message | contains("User ID does not match")) | .linkedin_user_id' | head -10

echo ""
echo "=== ACCOUNTS NOT IN DATABASE BUT IN UNIPILE ==="
echo "Unipile account KeHOhroOTSut7IQr5DU4Ag (Martin Schechtner) is missing from database"
