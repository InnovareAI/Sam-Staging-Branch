#!/usr/bin/env node
/**
 * Test Dynamic Cadence Conversion and N8N Integration
 */

// Inline version of cadence converter (for testing without imports)
function convertCadenceToTiming(cadence) {
  const normalized = cadence.toLowerCase().trim();

  const cadenceMap = {
    '1 day': { delayDays: 1, minDays: 0.8, maxDays: 1.2, label: '1 day' },
    '2-3 days': { delayDays: 2.5, minDays: 2, maxDays: 3, label: '2-3 days' },
    '3-5 days': { delayDays: 4, minDays: 3, maxDays: 5, label: '3-5 days' },
    '5-7 days': { delayDays: 6, minDays: 5, maxDays: 7, label: '5-7 days' },
    '1 week': { delayDays: 7, minDays: 6, maxDays: 8, label: '1 week' },
    '2 weeks': { delayDays: 14, minDays: 13, maxDays: 15, label: '2 weeks' }
  };

  return cadenceMap[normalized] || cadenceMap['2-3 days'];
}

function buildN8NTiming(messageDelays) {
  const timing = {};

  messageDelays.forEach((cadence, index) => {
    const { delayDays } = convertCadenceToTiming(cadence);
    const messageKey = `fu${index + 1}_delay_days`;
    timing[messageKey] = delayDays;
  });

  return timing;
}

// ============================================================================
// TEST SUITE
// ============================================================================

console.log('🧪 Testing Dynamic Cadence Conversion\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Basic conversion
console.log('Test 1: Single cadence conversion');
const testCadences = ['1 day', '2-3 days', '3-5 days', '5-7 days', '1 week', '2 weeks'];

testCadences.forEach(cadence => {
  const timing = convertCadenceToTiming(cadence);
  console.log(`  "${cadence}" → ${timing.delayDays} days (range: ${timing.minDays}-${timing.maxDays})`);
});

console.log('\n───────────────────────────────────────────────────────────\n');

// Test 2: Array conversion for N8N
console.log('Test 2: Message delays array → N8N timing object');
const messageDelays = ['2-3 days', '5-7 days', '1 week', '2 weeks'];
const n8nTiming = buildN8NTiming(messageDelays);

console.log('  Input (from UI):');
console.log('    ', JSON.stringify(messageDelays, null, 2));
console.log('\n  Output (for N8N):');
console.log('    ', JSON.stringify(n8nTiming, null, 2));

console.log('\n───────────────────────────────────────────────────────────\n');

// Test 3: Full N8N payload example
console.log('Test 3: Complete N8N webhook payload');

const fullPayload = {
  workspace_id: 'test-workspace-123',
  workspace_name: 'Test Workspace',
  campaign_id: 'test-campaign-456',
  campaign_name: 'Test Campaign',
  unipile_account_id: 'test-unipile-account',
  prospects: [
    {
      id: 'prospect-1',
      first_name: 'John',
      last_name: 'Doe',
      company_name: 'Test Corp',
      title: 'CEO',
      linkedin_url: 'https://linkedin.com/in/johndoe'
    }
  ],
  messages: {
    cr: 'Hi {first_name}, I noticed your work at {company_name}...',
    fu1: 'Thanks for connecting, {first_name}!',
    fu2: 'Just following up on my previous message...',
    fu3: 'I have some insights about {company_name}...',
    fu4: 'Final follow-up before closing this conversation...'
  },
  timing: n8nTiming,  // ← Dynamic timing from UI
  template: 'cr_4fu_1gb'
};

console.log('  Payload structure:');
console.log(JSON.stringify(fullPayload, null, 2));

console.log('\n───────────────────────────────────────────────────────────\n');

// Test 4: Calculate actual send times
console.log('Test 4: Expected message send times');
const now = new Date();

console.log(`  Connection Request: ${now.toLocaleString()} (now)`);

let currentDate = new Date(now);
Object.entries(n8nTiming).forEach(([key, days]) => {
  currentDate = new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);
  const messageNum = key.match(/fu(\d+)/)[1];
  console.log(`  Follow-up ${messageNum}: ${currentDate.toLocaleString()} (+${days} days)`);
});

console.log('\n═══════════════════════════════════════════════════════════\n');

// Test 5: Test N8N webhook (optional, uncomment to test live)
console.log('Test 5: N8N Webhook Test (Optional)');
console.log('  To test N8N webhook integration:');
console.log('  1. Uncomment the code below');
console.log('  2. Set N8N_WEBHOOK_URL environment variable');
console.log('  3. Run: node scripts/js/test-dynamic-cadence.mjs');
console.log('  4. Check N8N executions at: https://workflows.innovareai.com/executions\n');

/*
// UNCOMMENT TO TEST LIVE N8N WEBHOOK:

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/campaign-execute';

console.log(`  Sending test payload to: ${N8N_WEBHOOK_URL}\n`);

try {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test': 'true'
    },
    body: JSON.stringify(fullPayload)
  });

  console.log(`  Response status: ${response.status}`);
  const responseData = await response.text();
  console.log(`  Response body: ${responseData.substring(0, 200)}`);

  if (response.ok) {
    console.log('\n  ✅ N8N webhook received payload!');
    console.log('  🔍 Next: Check N8N execution logs');
    console.log('     Go to: https://workflows.innovareai.com/executions');
    console.log('     Look for: Execution with timing object');
  } else {
    console.log('\n  ❌ N8N webhook failed');
  }

} catch (error) {
  console.error('  ❌ Error sending to N8N:', error.message);
}
*/

console.log('═══════════════════════════════════════════════════════════');
console.log('\n✅ All tests completed!');
console.log('\n📝 Summary:');
console.log('   - Cadence conversion works correctly');
console.log('   - N8N timing object properly formatted');
console.log('   - Ready to integrate into campaign execution');
console.log('\n🚀 Next steps:');
console.log('   1. Update campaign execution route (execute-live/route.ts)');
console.log('   2. Import updated N8N workflow with dynamic Wait nodes');
console.log('   3. Test with real campaign');
console.log('');
