#!/usr/bin/env node
/**
 * Test N8N webhook directly with realistic payload
 */

import 'dotenv/config';

const WEBHOOK_URL = 'https://workflows.innovareai.com/webhook/campaign-execute';

const testPayload = {
  workspace_id: 'test-workspace',
  workspace_name: 'Test Workspace',
  campaign_id: 'test-campaign',
  campaign_name: 'Test Campaign',
  linkedin_account_name: 'Test LinkedIn',
  unipile_account_id: 'test-unipile-account',
  prospects: [
    {
      id: 'test-prospect-1',
      linkedin_url: 'https://linkedin.com/in/test-person',
      first_name: 'Test',
      last_name: 'Person',
      company_name: 'Test Company',
      title: 'CEO'
    }
  ],
  messages: {
    cr: 'Hi Test, this is a test connection request.',
    fu1: 'Follow up 1',
    fu2: 'Follow up 2',
    fu3: 'Follow up 3',
    fu4: 'Follow up 4',
    gb: 'Goodbye message'
  },
  timing: {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },
  template: 'cr_4fu_1gb'
};

console.log('🧪 Testing N8N webhook directly...\n');
console.log('URL:', WEBHOOK_URL);
console.log('Payload:', JSON.stringify(testPayload, null, 2));
console.log('\n📤 Sending request...\n');

try {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test': 'true'
    },
    body: JSON.stringify(testPayload)
  });

  console.log(`📊 Response status: ${response.status}`);
  console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();
  console.log(`📊 Response body:`, responseText.substring(0, 500));

  if (response.ok) {
    console.log('\n✅ Webhook received request');
    console.log('\n🔍 Next: Check N8N execution log');
    console.log('   Go to: https://workflows.innovareai.com/executions');
    console.log('   Look for execution with timestamp:', new Date().toLocaleTimeString());
    console.log('   Expected: Multiple nodes executed (NOT 0.03s)');
  } else {
    console.log('\n❌ Webhook failed');
  }

} catch (error) {
  console.error('\n❌ Request failed:', error.message);
}
