#!/bin/bash
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "Updating campaign type to messenger..."
curl -s -X PATCH "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns?id=eq.b961fbd1-e0e9-49d3-81c3-c0b7d6ee66ab" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"campaign_type": "messenger"}' | jq

echo ""
echo "Verifying..."
curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns?select=id,name,campaign_type&id=eq.b961fbd1-e0e9-49d3-81c3-c0b7d6ee66ab" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | jq
