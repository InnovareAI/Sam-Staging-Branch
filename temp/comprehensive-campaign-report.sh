#!/bin/bash

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

generate_campaign_report() {
  local campaign_id=$1
  local campaign_data=$2

  _jq() {
    echo "$campaign_data" | jq -r "$1"
  }

  campaign_name=$(_jq '.name')
  is_active=$(_jq '.is_active')
  campaign_type=$(_jq '.campaign_type // "linkedin_only"')
  created_at=$(_jq '.created_at')

  echo ""
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
  else
    echo "      (No prospects)"
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
    echo "   📤 Sent Today (Dec 19, 2025): $sent_today"

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
  issues_found=0

  if [ "$is_active" = "false" ]; then
    if [ "$issues_found" -eq 0 ]; then
      echo "   ⚠️  Issues:"
    fi
    echo "      - Campaign is PAUSED"
    issues_found=1
  fi

  if [ "$total_queue" -eq 0 ]; then
    if [ "$issues_found" -eq 0 ]; then
      echo "   ⚠️  Issues:"
    fi
    echo "      - Send queue is EMPTY"
    issues_found=1
  fi

  if [ "$total_prospects" -eq 0 ]; then
    if [ "$issues_found" -eq 0 ]; then
      echo "   ⚠️  Issues:"
    fi
    echo "      - No prospects found"
    issues_found=1
  fi

  if [ "$issues_found" -eq 0 ]; then
    echo "   ✅ No issues detected"
  fi

  echo ""
}

# Main report
echo "==================================================================="
echo "COMPREHENSIVE CAMPAIGN OVERVIEW REPORT"
echo "December 19, 2025"
echo "==================================================================="

# Get all campaigns
all_campaigns=$(curl -s "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns?select=*&order=created_at.desc&limit=200" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY")

# CHARISSA
echo ""
echo "==================================================================="
echo "👤 CHARISSA"
echo "==================================================================="

charissa_campaigns=$(echo "$all_campaigns" | jq -c '.[] | select(.name | test("(?i)cha"))')

if [ -z "$charissa_campaigns" ]; then
  echo "❌ No campaigns found"
else
  count=$(echo "$charissa_campaigns" | wc -l | tr -d ' ')
  echo "Found $count campaign(s):"

  echo "$charissa_campaigns" | while read -r campaign; do
    campaign_id=$(echo "$campaign" | jq -r '.id')
    generate_campaign_report "$campaign_id" "$campaign"
  done
fi

# MICHELLE
echo ""
echo "==================================================================="
echo "👤 MICHELLE"
echo "==================================================================="

michelle_campaigns=$(echo "$all_campaigns" | jq -c '.[] | select(.name | test("(?i)mich"))')

if [ -z "$michelle_campaigns" ]; then
  echo "❌ No campaigns found"
else
  count=$(echo "$michelle_campaigns" | wc -l | tr -d ' ')
  echo "Found $count campaign(s):"

  echo "$michelle_campaigns" | while read -r campaign; do
    campaign_id=$(echo "$campaign" | jq -r '.id')
    generate_campaign_report "$campaign_id" "$campaign"
  done
fi

# IRISH
echo ""
echo "==================================================================="
echo "👤 IRISH"
echo "==================================================================="

irish_campaigns=$(echo "$all_campaigns" | jq -c '.[] | select(.name | test("(?i)irish"))')

if [ -z "$irish_campaigns" ]; then
  echo "❌ No campaigns found"
else
  count=$(echo "$irish_campaigns" | wc -l | tr -d ' ')
  echo "Found $count campaign(s):"

  echo "$irish_campaigns" | while read -r campaign; do
    campaign_id=$(echo "$campaign" | jq -r '.id')
    generate_campaign_report "$campaign_id" "$campaign"
  done
fi

# SAMANTHA
echo ""
echo "==================================================================="
echo "👤 SAMANTHA"
echo "==================================================================="

# Try both "sam" and "samantha"
samantha_campaigns=$(echo "$all_campaigns" | jq -c '.[] | select(.name | test("(?i)samantha"))')

if [ -z "$samantha_campaigns" ]; then
  echo "❌ No campaigns found for Samantha"
else
  count=$(echo "$samantha_campaigns" | wc -l | tr -d ' ')
  echo "Found $count campaign(s):"

  echo "$samantha_campaigns" | while read -r campaign; do
    campaign_id=$(echo "$campaign" | jq -r '.id')
    generate_campaign_report "$campaign_id" "$campaign"
  done
fi

# THORSTEN
echo ""
echo "==================================================================="
echo "👤 THORSTEN"
echo "==================================================================="

thorsten_campaigns=$(echo "$all_campaigns" | jq -c '.[] | select(.name | test("(?i)tho"))')

if [ -z "$thorsten_campaigns" ]; then
  echo "❌ No campaigns found"
else
  count=$(echo "$thorsten_campaigns" | wc -l | tr -d ' ')
  echo "Found $count campaign(s):"

  echo "$thorsten_campaigns" | while read -r campaign; do
    campaign_id=$(echo "$campaign" | jq -r '.id')
    generate_campaign_report "$campaign_id" "$campaign"
  done
fi

echo ""
echo "==================================================================="
echo "END OF REPORT"
echo "==================================================================="
