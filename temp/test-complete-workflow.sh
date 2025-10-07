#!/bin/bash

# Test Complete Email-Only HITL Workflow
# This script tests the end-to-end email workflow

echo "🧪 Testing SAM Email-Only HITL Workflow"
echo "========================================"
echo ""

# Test 1: Send prospect reply
echo "📧 Test 1: Simulating prospect reply to campaign..."
echo ""

CAMPAIGN_ID="00000000-0000-0000-0000-000000000001"
PROSPECT_ID="00000000-0000-0000-0000-000000000002"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
MESSAGE_ID="test-$(date +%s)@example.com"

curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d "{
    \"From\": \"john.smith@techcorp.com\",
    \"FromFull\": {
      \"Email\": \"john.smith@techcorp.com\",
      \"Name\": \"John Smith\"
    },
    \"To\": \"reply+${CAMPAIGN_ID}+${PROSPECT_ID}@sam.innovareai.com\",
    \"ToFull\": [{
      \"Email\": \"reply+${CAMPAIGN_ID}+${PROSPECT_ID}@sam.innovareai.com\",
      \"MailboxHash\": \"reply-${CAMPAIGN_ID}-${PROSPECT_ID}\"
    }],
    \"Subject\": \"Re: AI Solutions for Your Business\",
    \"TextBody\": \"Hi! Very interested in learning more about your AI platform. Can we schedule a call next week?\",
    \"HtmlBody\": \"<p>Hi! Very interested in learning more about your AI platform. Can we schedule a call next week?</p>\",
    \"Date\": \"${TIMESTAMP}\",
    \"MessageID\": \"${MESSAGE_ID}\"
  }"

echo ""
echo "✅ Prospect reply sent"
echo ""
echo "Expected results:"
echo "  1. Email saved to email_responses"
echo "  2. Campaign reply created with priority: urgent"
echo "  3. SAM draft generated (within 5 seconds)"
echo "  4. Notification email sent to HITL"
echo ""
echo "⏳ Waiting 6 seconds for draft generation..."
sleep 6

echo ""
echo "📋 Checking database..."
echo ""

# Check email_responses
echo "Checking email_responses table:"
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

supabase
  .from('email_responses')
  .select('id, from_email, subject, sentiment, received_at')
  .eq('message_id', '${MESSAGE_ID}')
  .single()
  .then(({ data, error }) => {
    if (error) {
      console.log('❌ Email not found:', error.message);
    } else {
      console.log('✅ Email saved:');
      console.log('   ID:', data.id);
      console.log('   From:', data.from_email);
      console.log('   Sentiment:', data.sentiment || 'not analyzed');
      console.log('   Received:', new Date(data.received_at).toLocaleString());
    }
  });
"

echo ""
echo "Checking campaign_replies table:"
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

supabase
  .from('campaign_replies')
  .select('id, status, priority, sentiment, ai_suggested_response, draft_generated_at, received_at')
  .order('received_at', { ascending: false })
  .limit(1)
  .single()
  .then(({ data, error }) => {
    if (error) {
      console.log('❌ Campaign reply not found:', error.message);
    } else {
      console.log('✅ Campaign reply created:');
      console.log('   ID:', data.id);
      console.log('   Status:', data.status);
      console.log('   Priority:', data.priority);
      console.log('   Sentiment:', data.sentiment || 'not analyzed');
      console.log('   Draft generated:', data.draft_generated_at ? '✅' : '❌ Not yet');
      if (data.ai_suggested_response) {
        console.log('   Draft preview:', data.ai_suggested_response.substring(0, 100) + '...');
      }
      console.log('');
      console.log('💡 Reply ID for next test:', data.id);
    }
  });
"

echo ""
echo "========================================"
echo "📧 Next Steps:"
echo ""
echo "1. Check your email for HITL notification from Sam"
echo "2. The notification should have:"
echo "   - Subject: '🟢 John Smith replied - Draft ready'"
echo "   - Reply-To: draft+{replyId}@sam.innovareai.com"
echo "   - Instructions for APPROVE/EDIT/REFUSE"
echo ""
echo "3. To test APPROVE, reply to that email with: APPROVE"
echo "4. To test EDIT, reply with your edited message"
echo "5. To test REFUSE, reply with: REFUSE"
echo ""
echo "🔍 Or use the curl commands in: temp/test-email-workflow.md"
echo "========================================"
