#!/bin/bash

# Cron-Job.org Setup via Manual API
# This script creates the cron job using cron-job.org's API
#
# Requires:
#   - API_KEY: Your cron-job.org API key
#   - CRON_SECRET: Your CRON_SECRET from netlify env:list
#
# Usage:
#   ./create-cron-job.sh "API_KEY" "CRON_SECRET"

API_KEY="${1:-}"
CRON_SECRET="${2:-}"

if [[ -z "$API_KEY" || -z "$CRON_SECRET" ]]; then
  echo "❌ Usage: $0 <API_KEY> <CRON_SECRET>"
  echo ""
  echo "Example:"
  echo "  $0 'XuT71S7zg+G4E7eSb0kjvrrB7AwRw9vSZB9hzOBXTgw=' '792e0c09...'"
  exit 1
fi

echo "🚀 Setting up cron-job.org job..."
echo ""

# Note: cron-job.org doesn't have a standard REST API that's publicly documented
# The easiest approach is to use the web interface, but we'll provide curl examples
# for those who want to automate this

echo "📋 Job Configuration:"
echo "  Title: SAM - Process Send Queue"
echo "  URL: https://app.meet-sam.com/api/cron/process-send-queue"
echo "  Schedule: * * * * * (every minute)"
echo "  Method: POST"
echo "  Header: x-cron-secret: $CRON_SECRET"
echo ""

echo "⚠️  Note: cron-job.org doesn't expose a standard API for job creation."
echo ""
echo "Two options:"
echo ""
echo "OPTION 1: Use the Web UI (Recommended)"
echo "  1. Go to: https://cron-job.org/en/members/"
echo "  2. Click 'Create Cronjob'"
echo "  3. Fill in the configuration above"
echo "  4. In HTTP Headers, add:"
echo "     Name: x-cron-secret"
echo "     Value: $CRON_SECRET"
echo "  5. Click Save"
echo ""

echo "OPTION 2: Try API (if endpoint exists)"
echo ""
echo "# Create job"
echo "curl -X POST 'https://cron-job.org/api/v1/cronjob' \\"
echo "  -H 'Authorization: Bearer $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"title\": \"SAM - Process Send Queue\","
echo "    \"url\": \"https://app.meet-sam.com/api/cron/process-send-queue\","
echo "    \"expression\": \"* * * * *\","
echo "    \"timezone\": \"UTC\","
echo "    \"auth\": null,"
echo "    \"headers\": {"
echo "      \"x-cron-secret\": \"$CRON_SECRET\","
echo "      \"Content-Type\": \"application/json\""
echo "    },"
echo "    \"method\": \"POST\""
echo "  }'"
echo ""

echo "📝 After setup, verify the job is working:"
echo ""
echo "1. Go to: https://cron-job.org/en/members/"
echo "2. Find 'SAM - Process Send Queue'"
echo "3. Check 'Execution log' for recent runs"
echo "4. Verify status shows ENABLED (green)"
echo ""
