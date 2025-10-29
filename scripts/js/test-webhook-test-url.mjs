#!/usr/bin/env node
import 'dotenv/config';

const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';
const TEST_WEBHOOK_URL = `https://workflows.innovareai.com/webhook-test/${WORKFLOW_ID}`;

const testPayload = {
  workspace_id: "test-workspace",
  workspace_name: "Test Workspace",
  campaign_id: "test-campaign",
  campaign_name: "Test Campaign",
  unipile_account_id: "test-unipile-account",
  unipile_dsn: process.env.UNIPILE_DSN || 'api6.unipile.com:13670',
  unipile_api_key: process.env.UNIPILE_API_KEY,
  prospects: [{
    id: "test-prospect-1",
    linkedin_url: "https://linkedin.com/in/test-person",
    first_name: "Test",
    last_name: "Person",
    company_name: "Test Company"
  }],
  messages: {
    cr: "Hi Test, this is a test connection request."
  }
};

console.log('🧪 Testing N8N Test Webhook URL...\n');
console.log('URL:', TEST_WEBHOOK_URL);
console.log('Note: Test URLs work even when workflow is not activated\n');

try {
  const response = await fetch(TEST_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });

  console.log('📊 Status:', response.status);
  
  const text = await response.text();
  console.log('📊 Response:', text.substring(0, 500));

  if (response.ok) {
    console.log('\n✅ Test webhook worked!');
  } else {
    console.log('\n❌ Test webhook failed');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
