#!/bin/bash

SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ"

echo "=========================================="
echo "SAM MESSAGING PLATFORM - HEALTH CHECK"
echo "Run Time: $(date)"
echo "=========================================="
echo ""

# 1. Queue Status
echo "1. SEND QUEUE STATUS"
echo "-------------------"

# Overdue messages (scheduled_send_time < now and status = 'pending')
OVERDUE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/rpc/count_overdue_messages" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null || echo "0")

# If RPC doesn't exist, use direct query
if [ "$OVERDUE" == "0" ] || [ -z "$OVERDUE" ]; then
  NOW=$(date -u +%Y-%m-%dT%H:%M:%S)
  OVERDUE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/send_queue?status=eq.pending&scheduled_send_time=lt.${NOW}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: count=exact" | grep -oP '(?<=content-range: \*/)[0-9]+' || echo "0")
fi

# Pending count
PENDING=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/send_queue?status=eq.pending" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

# Sent today
TODAY=$(date -u +%Y-%m-%d)
SENT_TODAY=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/send_queue?status=eq.sent&sent_at=gte.${TODAY}T00:00:00" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

# Failed count
FAILED=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/send_queue?status=eq.failed" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

echo "Overdue Messages: ${OVERDUE:-0}"
echo "Pending Messages: ${PENDING:-0}"
echo "Sent Today: ${SENT_TODAY:-0}"
echo "Failed Messages: ${FAILED:-0}"
echo ""

# 2. Reply Drafts Status
echo "2. REPLY DRAFTS STATUS"
echo "---------------------"

# Pending approvals
PENDING_DRAFTS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reply_drafts?status=eq.pending_approval" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

# Expired drafts (created_at older than 7 days and still pending)
SEVEN_DAYS_AGO=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)
EXPIRED_DRAFTS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/reply_drafts?status=eq.pending_approval&created_at=lt.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

echo "Pending Approvals: ${PENDING_DRAFTS:-0}"
echo "Expired Drafts (>7 days): ${EXPIRED_DRAFTS:-0}"
echo ""

# 3. Active Campaigns
echo "3. ACTIVE CAMPAIGNS"
echo "------------------"

# Total active campaigns
ACTIVE_CAMPAIGNS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/campaigns?status=eq.active" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

# Campaigns without LinkedIn accounts
NO_LINKEDIN=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/campaigns?status=eq.active&linkedin_account_id=is.null&campaign_type=not.eq.email_only" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact" -D - | grep -i "content-range" | grep -oP '\d+$' || echo "0")

echo "Active Campaigns: ${ACTIVE_CAMPAIGNS:-0}"
echo "Without LinkedIn Account: ${NO_LINKEDIN:-0}"
echo ""

# 4. Unipile Accounts
echo "4. UNIPILE ACCOUNTS"
echo "------------------"

# Get all accounts with their status
ACCOUNTS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/user_unipile_accounts?select=id,name,status,provider" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

# Count by status
TOTAL_ACCOUNTS=$(echo "$ACCOUNTS" | jq -r 'length' 2>/dev/null || echo "0")
ACTIVE_ACCOUNTS=$(echo "$ACCOUNTS" | jq -r '[.[] | select(.status == "active")] | length' 2>/dev/null || echo "0")
CONNECTED_ACCOUNTS=$(echo "$ACCOUNTS" | jq -r '[.[] | select(.status == "connected")] | length' 2>/dev/null || echo "0")
INACTIVE_ACCOUNTS=$(echo "$ACCOUNTS" | jq -r '[.[] | select(.status == "inactive")] | length' 2>/dev/null || echo "0")

echo "Total Accounts: ${TOTAL_ACCOUNTS:-0}"
echo "Active: ${ACTIVE_ACCOUNTS:-0}"
echo "Connected (should be active): ${CONNECTED_ACCOUNTS:-0}"
echo "Inactive: ${INACTIVE_ACCOUNTS:-0}"
echo ""

# List all accounts
echo "Account Details:"
if [ "$TOTAL_ACCOUNTS" != "0" ]; then
  echo "$ACCOUNTS" | jq -r '.[] | "  - \(.name // "Unnamed") [\(.provider)]: \(.status)"' 2>/dev/null || echo "  (Unable to parse account details)"
else
  echo "  (No accounts found)"
fi
echo ""

# 5. Summary
echo "=========================================="
echo "HEALTH CHECK SUMMARY"
echo "=========================================="
echo ""

# Determine status for each area
OVERDUE=${OVERDUE:-0}
PENDING=${PENDING:-0}
SENT_TODAY=${SENT_TODAY:-0}
FAILED=${FAILED:-0}
EXPIRED_DRAFTS=${EXPIRED_DRAFTS:-0}
PENDING_DRAFTS=${PENDING_DRAFTS:-0}
NO_LINKEDIN=${NO_LINKEDIN:-0}
ACTIVE_CAMPAIGNS=${ACTIVE_CAMPAIGNS:-0}
CONNECTED_ACCOUNTS=${CONNECTED_ACCOUNTS:-0}
INACTIVE_ACCOUNTS=${INACTIVE_ACCOUNTS:-0}
ACTIVE_ACCOUNTS=${ACTIVE_ACCOUNTS:-0}

if [ "$OVERDUE" -eq 0 ]; then
  QUEUE_STATUS="✅"
else
  QUEUE_STATUS="⚠️"
fi

if [ "$EXPIRED_DRAFTS" -eq 0 ]; then
  DRAFTS_STATUS="✅"
else
  DRAFTS_STATUS="⚠️"
fi

if [ "$NO_LINKEDIN" -eq 0 ]; then
  CAMPAIGNS_STATUS="✅"
else
  CAMPAIGNS_STATUS="⚠️"
fi

if [ "$CONNECTED_ACCOUNTS" -eq 0 ] && [ "$INACTIVE_ACCOUNTS" -eq 0 ]; then
  ACCOUNTS_STATUS="✅"
elif [ "$CONNECTED_ACCOUNTS" -gt 0 ]; then
  ACCOUNTS_STATUS="⚠️"
else
  ACCOUNTS_STATUS="✅"
fi

printf "%-30s | %-10s | %s\n" "Component" "Status" "Details"
printf "%-30s | %-10s | %s\n" "-----------------------------" "----------" "-------------------"
printf "%-30s | %-10s | %s\n" "Send Queue" "$QUEUE_STATUS" "$OVERDUE overdue, $PENDING pending, $SENT_TODAY sent today"
printf "%-30s | %-10s | %s\n" "Reply Drafts" "$DRAFTS_STATUS" "$PENDING_DRAFTS pending, $EXPIRED_DRAFTS expired"
printf "%-30s | %-10s | %s\n" "Active Campaigns" "$CAMPAIGNS_STATUS" "$ACTIVE_CAMPAIGNS total, $NO_LINKEDIN without LinkedIn"
printf "%-30s | %-10s | %s\n" "Unipile Accounts" "$ACCOUNTS_STATUS" "$ACTIVE_ACCOUNTS active, $CONNECTED_ACCOUNTS connected, $INACTIVE_ACCOUNTS inactive"
echo ""

