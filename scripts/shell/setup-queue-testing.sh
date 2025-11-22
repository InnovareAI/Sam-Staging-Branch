#!/bin/bash

# Setup script for queue-based campaign testing
# This script helps configure the queue system for safe campaign testing
# Run this script to set up cron-job.org and verify Netlify deployment

set -e

echo "🚀 SAM Queue-Based Campaign Testing - Setup Script"
echo "=================================================="
echo ""

# Step 1: Verify current directory
echo "Step 1: Verifying environment..."
if [[ ! -f "package.json" ]]; then
  echo "❌ Error: package.json not found. Run this script from project root."
  exit 1
fi
echo "✅ Project directory verified"
echo ""

# Step 2: Check Netlify CLI is installed
echo "Step 2: Checking Netlify CLI..."
if ! command -v netlify &> /dev/null; then
  echo "❌ Netlify CLI not installed. Install with: npm install -g netlify-cli"
  exit 1
fi
echo "✅ Netlify CLI is installed"
echo ""

# Step 3: Build and deploy
echo "Step 3: Building and deploying code..."
echo "Running: npm run build"
npm run build
echo ""
echo "Running: netlify deploy --prod"
netlify deploy --prod
echo "✅ Deployment complete"
echo ""

# Step 4: Instructions for Supabase SQL
echo "Step 4: Create send_queue table in Supabase"
echo "==========================================="
echo ""
echo "🔗 Go to: https://app.supabase.com/project/latxadqrvrrrcvkktrog/sql/new"
echo ""
echo "Copy and paste this SQL:"
echo ""
cat sql/migrations/011-create-send-queue-table.sql
echo ""
echo "Then click 'Run' button"
echo ""

# Step 5: Instructions for cron-job.org
echo ""
echo "Step 5: Set up cron-job.org"
echo "============================"
echo ""
echo "You'll need the API key. Ask for it if you don't have it."
echo ""
echo "Visit: https://cron-job.org/en/members/"
echo ""
echo "Create a new job with these settings:"
echo "  - Job Name: SAM - Process Send Queue"
echo "  - URL: https://app.meet-sam.com/api/cron/process-send-queue"
echo "  - Method: POST"
echo "  - Schedule: * * * * * (every minute)"
echo "  - HTTP Headers:"
echo "      Name: x-cron-secret"
echo "      Value: (Get from: netlify env:list | grep CRON_SECRET)"
echo ""
echo "To get the CRON_SECRET:"
echo "  Run: netlify env:list | grep CRON_SECRET"
echo ""

# Step 6: Verify endpoints are working
echo ""
echo "Step 6: Verify endpoints"
echo "========================"
echo ""
echo "Test the queue creation endpoint:"
echo ""
echo "curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests-queued \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"campaignId\": \"YOUR_CAMPAIGN_ID\"}'"
echo ""
echo "You should get back:"
echo "  {\"success\": true, \"queued\": 5, \"skipped\": 0, ...}"
echo ""

echo ""
echo "Setup complete! Next steps:"
echo "1. Execute the SQL in Supabase (Step 4)"
echo "2. Create a test campaign with 5-10 prospects"
echo "3. Approve the prospects (move them to 'approved' status)"
echo "4. Queue the campaign using the endpoint from Step 6"
echo "5. Monitor progress in the send_queue table"
echo ""
