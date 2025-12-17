#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=== WORKSPACE INTEGRATIONS ==="
curl -s -X GET "${SUPABASE_URL}/rest/v1/workspace_integrations?select=*&order=updated_at.desc" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/workspace_integrations.json
cat /tmp/workspace_integrations.json | jq '.'

echo ""
echo "=== LINKEDIN MESSAGES SUMMARY ==="
curl -s -X GET "${SUPABASE_URL}/rest/v1/linkedin_messages?select=id,is_from_prospect,created_at&order=created_at.desc&limit=50" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/linkedin_messages.json
cat /tmp/linkedin_messages.json | jq 'group_by(.is_from_prospect) | map({is_from_prospect: .[0].is_from_prospect, count: length})'

echo ""
echo "=== EMAIL SEND QUEUE ==="
curl -s -X GET "${SUPABASE_URL}/rest/v1/email_send_queue?select=id,campaign_id,status,scheduled_for,sent_at&order=scheduled_for.asc&limit=50" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/email_send_queue.json
cat /tmp/email_send_queue.json | jq '.'

echo ""
echo "=== FOLLOW UP DRAFTS (Reply Agent) ==="
curl -s -X GET "${SUPABASE_URL}/rest/v1/follow_up_drafts?select=id,status,follow_up_type,created_at&order=created_at.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/follow_up_drafts.json
cat /tmp/follow_up_drafts.json | jq '.'

echo ""
echo "=== CRON EXECUTION LOGS ==="
curl -s -X GET "${SUPABASE_URL}/rest/v1/cron_execution_logs?select=id,cron_job_name,status,executed_at,error_message&order=executed_at.desc&limit=30" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > /tmp/cron_logs.json
cat /tmp/cron_logs.json | jq -r '.[] | "\(.executed_at) - \(.cron_job_name): \(.status) \(if .error_message then "- " + .error_message else "" end)"'
