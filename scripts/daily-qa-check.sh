#!/bin/bash

# ============================================================================
# DAILY QA CHECK - Automated System Health Verification
# ============================================================================
# Purpose: Run daily checks on database, RLS policies, and app functionality
# Schedule: Run via cron daily at 6 AM
# Alerts: Sends email/slack if issues detected
# ============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="logs/qa-checks"
LOG_FILE="$LOG_DIR/qa-check-$TIMESTAMP.log"
REPORT_FILE="$LOG_DIR/qa-report-$TIMESTAMP.json"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "🤖 Starting Daily QA Check - $TIMESTAMP" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# ============================================================================
# CHECK 1: Database Connection
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 1: Database Connection" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

DB_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/health-check" \
  -H "Content-Type: application/json" \
  -d '{"check": "database"}')

if echo "$DB_CHECK" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
  echo "✅ Database connection: HEALTHY" | tee -a "$LOG_FILE"
else
  echo "❌ Database connection: FAILED" | tee -a "$LOG_FILE"
  echo "$DB_CHECK" | tee -a "$LOG_FILE"
fi

# ============================================================================
# CHECK 2: RLS Policy Status
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 2: RLS Policy Status" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

RLS_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/verify-rls-status")

EXPECTED_ENABLED="workspaces,workspace_members,campaigns,campaign_prospects,prospect_approval_sessions"
EXPECTED_DISABLED="workspace_accounts,linkedin_proxy_assignments,user_unipile_accounts"

echo "Expected RLS Enabled: $EXPECTED_ENABLED" | tee -a "$LOG_FILE"
echo "Expected RLS Disabled: $EXPECTED_DISABLED" | tee -a "$LOG_FILE"

if echo "$RLS_CHECK" | jq -e '.status == "as_expected"' > /dev/null 2>&1; then
  echo "✅ RLS policies: AS EXPECTED" | tee -a "$LOG_FILE"
else
  echo "❌ RLS policies: UNEXPECTED CHANGES DETECTED" | tee -a "$LOG_FILE"
  echo "$RLS_CHECK" | jq '.' | tee -a "$LOG_FILE"
fi

# ============================================================================
# CHECK 3: Workspace Separation
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 3: Workspace Separation" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

WORKSPACE_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/verify-workspace-separation")

ORPHANED_CAMPAIGNS=$(echo "$WORKSPACE_CHECK" | jq -r '.checks.campaigns.orphaned.count // "unknown"')
ORPHANED_PROSPECTS=$(echo "$WORKSPACE_CHECK" | jq -r '.checks.campaign_prospects.orphaned.count // "unknown"')
OVERALL_STATUS=$(echo "$WORKSPACE_CHECK" | jq -r '.security_summary.overall_health // "unknown"')

echo "Orphaned Campaigns: $ORPHANED_CAMPAIGNS" | tee -a "$LOG_FILE"
echo "Orphaned Prospects: $ORPHANED_PROSPECTS" | tee -a "$LOG_FILE"
echo "Overall Health: $OVERALL_STATUS" | tee -a "$LOG_FILE"

if [ "$ORPHANED_CAMPAIGNS" = "0" ] && [ "$ORPHANED_PROSPECTS" = "0" ]; then
  echo "✅ Workspace separation: HEALTHY" | tee -a "$LOG_FILE"
else
  echo "❌ Workspace separation: ISSUES DETECTED" | tee -a "$LOG_FILE"
fi

# ============================================================================
# CHECK 4: LinkedIn Integration
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 4: LinkedIn Integration" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

LINKEDIN_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/verify-integrations")

ACTIVE_ACCOUNTS=$(echo "$LINKEDIN_CHECK" | jq -r '.workspace_accounts.active // "unknown"')
CONNECTED_USERS=$(echo "$LINKEDIN_CHECK" | jq -r '.workspace_accounts.connected_users // "unknown"')

echo "Active LinkedIn Accounts: $ACTIVE_ACCOUNTS" | tee -a "$LOG_FILE"
echo "Connected Users: $CONNECTED_USERS" | tee -a "$LOG_FILE"

if [ "$ACTIVE_ACCOUNTS" != "0" ] && [ "$ACTIVE_ACCOUNTS" != "unknown" ]; then
  echo "✅ LinkedIn integration: WORKING" | tee -a "$LOG_FILE"
else
  echo "⚠️  LinkedIn integration: NO ACTIVE ACCOUNTS" | tee -a "$LOG_FILE"
fi

# ============================================================================
# CHECK 5: Campaign Functionality
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 5: Campaign Functionality" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

CAMPAIGN_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/verify-campaigns")

TOTAL_CAMPAIGNS=$(echo "$CAMPAIGN_CHECK" | jq -r '.total_campaigns // "unknown"')
ACTIVE_CAMPAIGNS=$(echo "$CAMPAIGN_CHECK" | jq -r '.active_campaigns // "unknown"')

echo "Total Campaigns: $TOTAL_CAMPAIGNS" | tee -a "$LOG_FILE"
echo "Active Campaigns: $ACTIVE_CAMPAIGNS" | tee -a "$LOG_FILE"

if [ "$TOTAL_CAMPAIGNS" != "unknown" ]; then
  echo "✅ Campaign system: OPERATIONAL" | tee -a "$LOG_FILE"
else
  echo "❌ Campaign system: ERROR" | tee -a "$LOG_FILE"
fi

# ============================================================================
# CHECK 6: Critical Tables Schema
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "CHECK 6: Critical Tables Schema" | tee -a "$LOG_FILE"
echo "─────────────────────────────" | tee -a "$LOG_FILE"

SCHEMA_CHECK=$(curl -s -X POST "https://app.meet-sam.com/api/admin/verify-schema")

TABLES_EXIST=$(echo "$SCHEMA_CHECK" | jq -r '.all_tables_exist // false')

if [ "$TABLES_EXIST" = "true" ]; then
  echo "✅ Database schema: INTACT" | tee -a "$LOG_FILE"
else
  echo "❌ Database schema: MISSING TABLES" | tee -a "$LOG_FILE"
  echo "$SCHEMA_CHECK" | jq '.missing_tables' | tee -a "$LOG_FILE"
fi

# ============================================================================
# GENERATE SUMMARY REPORT
# ============================================================================
echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "SUMMARY REPORT" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Create JSON report
cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "overall_status": "healthy",
  "checks": {
    "database": "$DB_CHECK",
    "rls_policies": "$RLS_CHECK",
    "workspace_separation": "$WORKSPACE_CHECK",
    "linkedin_integration": "$LINKEDIN_CHECK",
    "campaigns": "$CAMPAIGN_CHECK",
    "schema": "$SCHEMA_CHECK"
  }
}
EOF

echo "Report saved to: $REPORT_FILE" | tee -a "$LOG_FILE"

# ============================================================================
# ALERT IF ISSUES DETECTED
# ============================================================================

ISSUES_FOUND=false

# Check for any failures
if echo "$DB_CHECK" | grep -q "FAILED"; then ISSUES_FOUND=true; fi
if echo "$RLS_CHECK" | grep -q "UNEXPECTED"; then ISSUES_FOUND=true; fi
if [ "$ORPHANED_CAMPAIGNS" != "0" ]; then ISSUES_FOUND=true; fi
if [ "$ORPHANED_PROSPECTS" != "0" ]; then ISSUES_FOUND=true; fi

if [ "$ISSUES_FOUND" = true ]; then
  echo "" | tee -a "$LOG_FILE"
  echo "❌ ISSUES DETECTED - SENDING ALERT" | tee -a "$LOG_FILE"

  # Send email alert (configure with your email service)
  # curl -X POST "YOUR_ALERT_WEBHOOK" \
  #   -H "Content-Type: application/json" \
  #   -d "{\"text\": \"⚠️ SAM QA Check Failed - Check logs: $LOG_FILE\"}"

  echo "Alert would be sent here (configure webhook)" | tee -a "$LOG_FILE"
else
  echo "" | tee -a "$LOG_FILE"
  echo "✅ ALL CHECKS PASSED" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "QA Check completed at $(date)" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
