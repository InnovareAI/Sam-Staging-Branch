#!/bin/bash

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "==================================================================="
echo "CAMPAIGN OVERVIEW REPORT - December 19, 2025"
echo "==================================================================="
echo ""

for person in "Charissa" "Michelle" "Irish" "Samantha" "Thorsten"; do
  echo "==================================================================="
  echo "📊 $person"
  echo "==================================================================="

  # Get campaigns
  campaigns=$(curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns?select=*&name=ilike.*${person}*" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY")

  count=$(echo "$campaigns" | jq '. | length')

  if [ "$count" -eq 0 ]; then
    echo "❌ No campaigns found for $person"
    echo ""
    continue
  fi

  echo ""
  echo "Found $count campaign(s):"
  echo ""

  # Process each campaign
  echo "$campaigns" | jq -r '.[] | @base64' | while read -r campaign; do
    _jq() {
      echo "$campaign" | base64 --decode | jq -r "$1"
    }

    campaign_id=$(_jq '.id')
    campaign_name=$(_jq '.name')
    is_active=$(_jq '.is_active')
    campaign_type=$(_jq '.campaign_type // "linkedin_only"')
    created_at=$(_jq '.created_at')

    echo "────────────────────────────────────────────────────────────────"
    echo "📌 Campaign: $campaign_name"
    echo "   ID: $campaign_id"

    if [ "$is_active" = "true" ]; then
      echo "   Status: ✅ ACTIVE"
    else
      echo "   Status: ⏸️  PAUSED"
    fi

    echo "   Type: $campaign_type"
    echo "   Created: $(date -j -f "%Y-%m-%dT%H:%M:%S" "${created_at:0:19}" "+%m/%d/%Y" 2>/dev/null || echo "$created_at")"

    # Get prospects
    prospects=$(curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaign_prospects?select=status&campaign_id=eq.$campaign_id" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY")

    total_prospects=$(echo "$prospects" | jq '. | length')
    echo ""
    echo "   📋 Prospects (Total: $total_prospects):"

    if [ "$total_prospects" -gt 0 ]; then
      echo "$prospects" | jq -r 'group_by(.status) | .[] | "      \(.[0].status): \(length)"'
    fi

    # Get send queue
    queue=$(curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/send_queue?select=status,sent_at,error_message&campaign_id=eq.$campaign_id" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY")

    total_queue=$(echo "$queue" | jq '. | length')
    echo ""
    echo "   📬 Send Queue (Total: $total_queue):"

    if [ "$total_queue" -eq 0 ]; then
      echo "      ⚠️  EMPTY QUEUE"
    else
      echo "$queue" | jq -r 'group_by(.status) | .[] | "      \(.[0].status): \(length)"'

      # Count sent today
      sent_today=$(echo "$queue" | jq '[.[] | select(.sent_at != null and .sent_at >= "2025-12-19T00:00:00" and .sent_at < "2025-12-20T00:00:00")] | length')
      echo ""
      echo "   📤 Sent Today (Dec 19): $sent_today"

      # Show failed items
      failed_count=$(echo "$queue" | jq '[.[] | select(.status == "failed")] | length')
      if [ "$failed_count" -gt 0 ]; then
        echo ""
        echo "   ❌ Failed Items: $failed_count"
        echo "$queue" | jq -r '[.[] | select(.status == "failed") | .error_message // "No error message"] | unique | .[] | "      - \(.)"' | head -3
      fi
    fi

    # Issues summary
    echo ""
    echo -n "   ⚠️  Issues:"

    issues=0
    if [ "$is_active" = "false" ]; then
      echo ""
      echo "      - Campaign is PAUSED"
      issues=1
    fi
    if [ "$total_queue" -eq 0 ]; then
      echo ""
      echo "      - Send queue is EMPTY"
      issues=1
    fi
    if [ "$failed_count" -gt 0 ]; then
      echo ""
      echo "      - $failed_count failed queue items"
      issues=1
    fi
    if [ "$total_prospects" -eq 0 ]; then
      echo ""
      echo "      - No prospects found"
      issues=1
    fi

    if [ "$issues" -eq 0 ]; then
      echo " None"
    fi

    echo ""
  done
done

echo "==================================================================="
echo "End of Report"
echo "==================================================================="
