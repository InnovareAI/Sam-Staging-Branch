#!/usr/bin/env node
/**
 * Test N8N TEST webhook endpoint (for workflow development/testing)
 */

const WEBHOOK_TEST_URL = 'https://workflows.innovareai.com/webhook-test/campaign-execute';

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

console.log('🧪 Testing N8N TEST webhook endpoint...\n');
console.log('URL:', WEBHOOK_TEST_URL);
console.log('\n📤 Sending request...\n');

try {
  const response = await fetch(WEBHOOK_TEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  });

  console.log(`📊 Response status: ${response.status}`);

  const responseText = await response.text();
  console.log(`📊 Response body:`, responseText.substring(0, 1000));

  if (response.ok) {
    console.log('\n✅ TEST webhook received request');
    console.log('\n🔍 Check N8N UI - workflow should show execution in progress');
  } else {
    console.log('\n❌ TEST webhook failed');
  }

} catch (error) {
  console.error('\n❌ Request failed:', error.message);
}
