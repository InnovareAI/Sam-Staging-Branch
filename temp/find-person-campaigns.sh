#!/bin/bash

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

# Get all campaigns
all_campaigns=$(curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns?select=*&order=created_at.desc&limit=200" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY")

echo "==================================================================="
echo "CAMPAIGN SEARCH RESULTS"
echo "==================================================================="
echo ""

# Search for Charissa (Cha)
echo "Searching for Charissa (Cha):"
echo "$all_campaigns" | jq -r '.[] | select(.name | test("(?i)cha")) | "  - \(.name) (ID: \(.id))"'
echo ""

# Search for Michelle (Mich)
echo "Searching for Michelle (Mich):"
echo "$all_campaigns" | jq -r '.[] | select(.name | test("(?i)mich")) | "  - \(.name) (ID: \(.id))"'
echo ""

# Search for Irish
echo "Searching for Irish:"
echo "$all_campaigns" | jq -r '.[] | select(.name | test("(?i)irish")) | "  - \(.name) (ID: \(.id))"'
echo ""

# Search for Samantha (Sam)
echo "Searching for Samantha (Sam):"
echo "$all_campaigns" | jq -r '.[] | select(.name | test("(?i)sam")) | "  - \(.name) (ID: \(.id))"'
echo ""

# Search for Thorsten (Tho, THO)
echo "Searching for Thorsten (Tho):"
echo "$all_campaigns" | jq -r '.[] | select(.name | test("(?i)tho")) | "  - \(.name) (ID: \(.id))"'
echo ""
