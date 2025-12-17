#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=== SAM AI PLATFORM HEALTH CHECK ==="
echo ""

echo "1. CAMPAIGNS"
curl -s -X GET "${SUPABASE_URL}/rest/v1/campaigns?select=id,name,status,campaign_type,workspace_id,linkedin_account_id,created_at&order=created_at.desc&limit=50" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/campaigns.json

echo "Total campaigns: $(cat /tmp/campaigns.json | jq '. | length')"
echo ""

echo "2. SEND QUEUE"
curl -s -X GET "${SUPABASE_URL}/rest/v1/send_queue?select=id,campaign_id,status,scheduled_for,sent_at,error_message&order=scheduled_for.asc&limit=100" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/send_queue.json

echo "Send queue items: $(cat /tmp/send_queue.json | jq '. | length')"
cat /tmp/send_queue.json | jq -r 'group_by(.status) | map({status: .[0].status, count: length})'
echo ""

echo "3. EMAIL QUEUE"
curl -s -X GET "${SUPABASE_URL}/rest/v1/email_queue?select=id,campaign_id,status,scheduled_for,sent_at,error_message&order=scheduled_for.asc&limit=100" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/email_queue.json

echo "Email queue items: $(cat /tmp/email_queue.json | jq '. | length')"
cat /tmp/email_queue.json | jq -r 'group_by(.status) | map({status: .[0].status, count: length})'
echo ""

echo "4. LINKEDIN ACCOUNTS"
curl -s -X GET "${SUPABASE_URL}/rest/v1/linkedin_accounts?select=id,account_id,user_email,connection_status,workspace_id,updated_at&order=updated_at.desc" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/linkedin_accounts.json

echo "LinkedIn accounts: $(cat /tmp/linkedin_accounts.json | jq '. | length')"
cat /tmp/linkedin_accounts.json | jq -r '.[] | "\(.user_email // "N/A"): \(.connection_status)"'
echo ""

echo "5. CAMPAIGN PROSPECTS"
curl -s -X GET "${SUPABASE_URL}/rest/v1/campaign_prospects?select=campaign_id,status&limit=1000" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/campaign_prospects.json

echo "Total prospects: $(cat /tmp/campaign_prospects.json | jq '. | length')"
cat /tmp/campaign_prospects.json | jq -r 'group_by(.status) | map({status: .[0].status, count: length})'
echo ""

echo "6. CRON EXECUTION LOGS (Recent)"
curl -s -X GET "${SUPABASE_URL}/rest/v1/cron_execution_logs?select=id,cron_job_name,status,executed_at,error_message&order=executed_at.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/cron_logs.json

echo "Recent cron executions:"
cat /tmp/cron_logs.json | jq -r '.[] | "\(.executed_at) - \(.cron_job_name): \(.status)"'
echo ""

echo "=== DETAILED DATA ==="
echo ""
echo "Campaigns:"
cat /tmp/campaigns.json | jq -r '.[] | "\(.name) (\(.id)): \(.status) - Type: \(.campaign_type // "N/A")"'
echo ""

echo "Pending send queue (next 10):"
cat /tmp/send_queue.json | jq -r '.[] | select(.status == "pending") | "\(.scheduled_for) - Campaign: \(.campaign_id)"' | head -10
echo ""

echo "Failed send queue:"
cat /tmp/send_queue.json | jq -r '.[] | select(.status == "failed") | "\(.scheduled_for) - Campaign: \(.campaign_id) - Error: \(.error_message)"'
echo ""
