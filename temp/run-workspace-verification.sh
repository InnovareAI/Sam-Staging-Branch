#!/bin/bash

# ============================================================================
# Workspace Separation Verification Script
# ============================================================================
# This script calls the workspace verification API endpoint and displays results
# Usage: bash temp/run-workspace-verification.sh [environment]
# ============================================================================

set -e

# Determine which environment to test
ENV="${1:-production}"

if [ "$ENV" = "production" ]; then
  API_URL="https://app.meet-sam.com/api/admin/verify-workspace-separation"
  echo "🔍 Running workspace verification on PRODUCTION"
elif [ "$ENV" = "staging" ]; then
  API_URL="https://devin-next-gen-staging.netlify.app/api/admin/verify-workspace-separation"
  echo "🔍 Running workspace verification on STAGING"
else
  API_URL="http://localhost:3000/api/admin/verify-workspace-separation"
  echo "🔍 Running workspace verification on LOCALHOST"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Workspace Separation & Security Verification"
echo "  Environment: $ENV"
echo "  Timestamp: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make the API request
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{}')

# Check if jq is available for pretty printing
if command -v jq &> /dev/null; then
  echo "$RESPONSE" | jq '.'

  # Extract and display security summary
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  SECURITY SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  STATUS=$(echo "$RESPONSE" | jq -r '.security_summary.status // "UNKNOWN"')
  HEALTH=$(echo "$RESPONSE" | jq -r '.security_summary.overall_health // "UNKNOWN"')

  echo "Status: $STATUS"
  echo "Overall Health: $HEALTH"
  echo ""

  # Display critical issues
  ISSUES=$(echo "$RESPONSE" | jq -r '.security_summary.critical_issues[]?' 2>/dev/null)
  if [ -n "$ISSUES" ]; then
    echo "❌ CRITICAL ISSUES:"
    echo "$ISSUES" | while read -r line; do
      echo "   - $line"
    done
    echo ""
  fi

  # Display warnings
  WARNINGS=$(echo "$RESPONSE" | jq -r '.security_summary.warnings[]?' 2>/dev/null)
  if [ -n "$WARNINGS" ]; then
    echo "⚠️  WARNINGS:"
    echo "$WARNINGS" | while read -r line; do
      echo "   - $line"
    done
    echo ""
  fi

  # Display workspace summary
  WORKSPACE_COUNT=$(echo "$RESPONSE" | jq -r '.checks.workspaces.total // 0')
  MEMBER_COUNT=$(echo "$RESPONSE" | jq -r '.checks.members.total // 0')
  CAMPAIGN_COUNT=$(echo "$RESPONSE" | jq -r '.checks.campaigns.total // 0')

  echo "📊 STATISTICS:"
  echo "   - Total Workspaces: $WORKSPACE_COUNT"
  echo "   - Total Members: $MEMBER_COUNT"
  echo "   - Total Campaigns: $CAMPAIGN_COUNT"
  echo ""

  if [ "$STATUS" = "HEALTHY" ] && [ "$HEALTH" = "EXCELLENT" ]; then
    echo "✅ All checks passed! Workspace separation is working correctly."
  elif [ "$STATUS" = "WARNINGS" ]; then
    echo "⚠️  Some warnings detected. Review the output above."
  else
    echo "❌ Critical issues detected. Immediate attention required!"
  fi

else
  # If jq is not available, just print raw JSON
  echo "$RESPONSE"
  echo ""
  echo "💡 TIP: Install 'jq' for prettier output: brew install jq"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verification complete at $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
