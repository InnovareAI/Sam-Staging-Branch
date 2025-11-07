#!/bin/bash

# Test the prospect status update webhook
# This simulates what N8N will do after each funnel stage

# Get a real prospect ID from the database
echo "🔍 Finding a test prospect..."

# You'll need to replace these with actual IDs from your database
PROSPECT_ID="benroodman-prospect-id"  # Replace with actual UUID
CAMPAIGN_ID="test-campaign-id"         # Replace with actual UUID
WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET_TOKEN}"

echo "Testing prospect status webhook..."
echo "Endpoint: https://app.meet-sam.com/api/campaigns/webhook/prospect-status"
echo ""

# Test 1: Connection Requested
echo "📤 Test 1: Sending connection_requested status..."
RESPONSE=$(curl -s -X POST https://app.meet-sam.com/api/campaigns/webhook/prospect-status \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"prospect_id\": \"${PROSPECT_ID}\",
    \"campaign_id\": \"${CAMPAIGN_ID}\",
    \"status\": \"connection_requested\",
    \"message_id\": \"test_msg_cr_$(date +%s)\",
    \"sent_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "Response: $RESPONSE"
echo ""

# Test 2: Connection Accepted
echo "📤 Test 2: Sending connection_accepted status..."
sleep 2
RESPONSE=$(curl -s -X POST https://app.meet-sam.com/api/campaigns/webhook/prospect-status \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"prospect_id\": \"${PROSPECT_ID}\",
    \"campaign_id\": \"${CAMPAIGN_ID}\",
    \"status\": \"connection_accepted\",
    \"sent_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "Response: $RESPONSE"
echo ""

# Test 3: Acceptance Message Sent
echo "📤 Test 3: Sending acceptance_message_sent status..."
sleep 2
RESPONSE=$(curl -s -X POST https://app.meet-sam.com/api/campaigns/webhook/prospect-status \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"prospect_id\": \"${PROSPECT_ID}\",
    \"campaign_id\": \"${CAMPAIGN_ID}\",
    \"status\": \"acceptance_message_sent\",
    \"message_id\": \"test_msg_am_$(date +%s)\",
    \"message_content\": \"Thanks for connecting, Ben!\",
    \"sent_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "Response: $RESPONSE"
echo ""

# Test 4: Follow-up 1 Sent
echo "📤 Test 4: Sending fu1_sent status..."
sleep 2
RESPONSE=$(curl -s -X POST https://app.meet-sam.com/api/campaigns/webhook/prospect-status \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"prospect_id\": \"${PROSPECT_ID}\",
    \"campaign_id\": \"${CAMPAIGN_ID}\",
    \"status\": \"fu1_sent\",
    \"message_id\": \"test_msg_fu1_$(date +%s)\",
    \"message_content\": \"Following up on our connection...\",
    \"sent_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

echo "Response: $RESPONSE"
echo ""

echo "✅ Testing complete!"
echo ""
echo "To verify in database, run:"
echo "node temp/check-funnel-stages.cjs"
