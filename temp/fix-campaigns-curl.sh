#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=== 1. Unpause Sebastian campaign ==="
curl -X PATCH "${SUPABASE_URL}/rest/v1/campaigns?name=ilike.*Sebastian*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"active"}'

echo -e "\n\n=== 2. Get ASP campaign ==="
ASP_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/campaigns?name=ilike.*ASP*Company*Follow*&select=id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$ASP_RESPONSE"

ASP_ID=$(echo "$ASP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "ASP Campaign ID: $ASP_ID"

if [ -n "$ASP_ID" ]; then
  echo -e "\n=== 3. Get pending prospects for ASP ==="
  PROSPECTS=$(curl -s "${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${ASP_ID}&status=eq.pending&select=id,prospect_id" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

  echo "Prospects: $PROSPECTS"

  # Build send_queue items
  QUEUE_ITEMS=$(echo "$PROSPECTS" | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
campaign_id = '$ASP_ID'
items = []
for p in data:
    items.append({
        'campaign_id': campaign_id,
        'prospect_id': p['prospect_id'],
        'campaign_prospect_id': p['id'],
        'scheduled_for': datetime.utcnow().isoformat(),
        'status': 'pending',
        'message_type': 'connection_request'
    })
print(json.dumps(items))
")

  echo -e "\n=== 4. Insert into send_queue ==="
  curl -X POST "${SUPABASE_URL}/rest/v1/send_queue" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$QUEUE_ITEMS"
fi
