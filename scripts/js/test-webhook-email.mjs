/**
 * Test Reply Agent Webhook - Triggers HITL Email
 */

const timestamp = new Date().toISOString();
const msgId = `test-msg-${Date.now()}`;

const payload = {
  event: "message.received",
  data: {
    id: msgId,
    account_id: "4Vv6oZ73RvarImDN6iYbbg", // Stan's LinkedIn account
    provider: "LINKEDIN",
    conversation_id: "test-conv-123",
    sender: {
      id: "stanbounev",
      name: "Stan Bounev",
      profile_url: "https://www.linkedin.com/in/stanbounev"
    },
    recipient: {
      id: "sam-user",
      name: "SAM"
    },
    text: "This looks interesting! We've been evaluating different outbound tools. How does SAM compare to Apollo and Outreach in terms of personalization? Also curious about pricing.",
    timestamp: timestamp
  }
};

console.log('📤 Sending test webhook to Reply Agent...');
console.log(`   Message ID: ${msgId}`);
console.log(`   Sender: ${payload.data.sender.name}`);
console.log(`   Message: "${payload.data.text.substring(0, 50)}..."`);
console.log('');

const response = await fetch('https://app.meet-sam.com/api/webhooks/unipile-messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const text = await response.text();
console.log(`Raw response (${response.status}): ${text.substring(0, 500)}`);

let result;
try {
  result = JSON.parse(text);
} catch (e) {
  console.log('Could not parse as JSON');
  process.exit(1);
}

console.log(`📥 Response (${response.status}):`);
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log('\n✅ Webhook processed successfully!');
  console.log(`   Reply ID: ${result.replyId}`);
  console.log(`   Intent: ${result.intent}`);
  console.log(`   Draft Generated: ${result.draftGenerated}`);
  console.log('\n📧 Check your inbox at tl@innovareai.com for the HITL email!');
} else {
  console.log('\n❌ Webhook failed:', result.error);
}
