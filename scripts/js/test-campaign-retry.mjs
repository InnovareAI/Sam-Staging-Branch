// Test campaign execution with corrected X-Api-Key authentication
import fetch from 'node-fetch';

const CAMPAIGN_ID = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';
const API_URL = 'https://app.meet-sam.com';

console.log('🧪 Testing Campaign Execution with X-Api-Key Authentication\n');
console.log(`Campaign ID: ${CAMPAIGN_ID}`);
console.log(`API URL: ${API_URL}\n`);

console.log('📤 Sending connection requests (first 5 prospects)...\n');

try {
  const response = await fetch(`${API_URL}/api/campaigns/direct/send-connection-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      campaignId: CAMPAIGN_ID
    })
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Non-JSON response:', text);
    process.exit(1);
  }

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Request failed:', result);
    process.exit(1);
  }

  console.log('✅ Request successful!\n');
  console.log('📊 Results:');
  console.log(`   Total processed: ${result.processed}`);
  console.log(`   Sent: ${result.sent}`);
  console.log(`   Failed: ${result.failed}\n`);

  if (result.results && result.results.length > 0) {
    console.log('📋 Individual Results:');
    result.results.forEach((r, i) => {
      const icon = r.status === 'success' ? '✅' : '❌';
      console.log(`   ${icon} ${i + 1}. ${r.name}: ${r.status}`);
      if (r.error) {
        console.log(`      Error: ${r.error}`);
      }
      if (r.status === 'success' && r.nextActionAt) {
        console.log(`      Next action: ${r.nextActionAt}`);
      }
    });
  }

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (result.sent > 0 && result.failed === 0) {
    console.log('✅ SUCCESS! Authentication fix is working!');
    console.log('   All connection requests sent successfully.');
  } else if (result.sent > 0 && result.failed > 0) {
    console.log('⚠️  PARTIAL SUCCESS');
    console.log(`   ${result.sent} sent, ${result.failed} failed.`);
    console.log('   Check error details above.');
  } else {
    console.log('❌ FAILED! No connection requests sent.');
    console.log('   Authentication may still be broken.');
  }
  console.log('='.repeat(60));

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
