/**
 * Test Direct Campaign System
 *
 * Tests the direct campaign system using Unipile API
 */

const CAMPAIGN_ID = '5bb3ac9c-eac3-475b-b2a5-5f939edace34'; // Charissa's test campaign

console.log('🧪 Testing Direct Campaign System\n');

// Test 1: Send connection requests
console.log('Test 1: Sending connection requests...\n');

const response = await fetch('http://localhost:3000/api/campaigns/direct/send-connection-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: CAMPAIGN_ID
  })
});

const result = await response.json();

if (response.ok) {
  console.log('✅ Success!');
  console.log(JSON.stringify(result, null, 2));
} else {
  console.error('❌ Failed:');
  console.error(JSON.stringify(result, null, 2));
}
