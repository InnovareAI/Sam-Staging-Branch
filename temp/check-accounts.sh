#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "Checking Unipile accounts..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/unipile_accounts?select=id,account_id,user_email,connection_status,workspace_id,updated_at" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq '.'

echo ""
echo "Checking conversation replies..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/conversation_replies?select=id,campaign_id,status,created_at&order=created_at.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq '.'

echo ""
echo "Checking LinkedIn commenting monitors..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/linkedin_commenting_monitors?select=id,monitor_name,status,hashtags&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | jq '.'
