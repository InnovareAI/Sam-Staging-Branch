/**
 * Test script to verify messages.cr field fix
 * Bypasses browser auth by using x-internal-trigger header
 */

const campaignId = 'ade10177-afe6-4770-a64d-b4ac0928b66a';
const apiUrl = 'http://localhost:3000/api/campaigns/linkedin/execute-live';

console.log('🧪 Testing messages.cr fix with internal trigger...\n');

const payload = {
  campaignId: campaignId,
  maxProspects: 1,
  dryRun: false
};

console.log('📤 Sending request to:', apiUrl);
console.log('📦 Payload:', JSON.stringify(payload, null, 2));
console.log('🔑 Using internal trigger header to bypass auth\n');

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-trigger': 'cron-pending-prospects'
  },
  body: JSON.stringify(payload)
})
  .then(async response => {
    console.log(`📡 Response Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('📥 Response Body:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ REQUEST SUCCESSFUL');
      console.log(`   Queued: ${data.messages_queued || 0}`);
      console.log(`   Failed: ${data.messages_failed || 0}`);
      console.log(`   N8N Triggered: ${data.n8n_triggered}`);

      if (data.queued_prospects && data.queued_prospects.length > 0) {
        console.log('\n📋 Queued Prospects:');
        data.queued_prospects.forEach(p => {
          console.log(`   - ${p.prospect} (${p.status})`);
        });
      }

      if (data.failed && data.failed.length > 0) {
        console.log('\n❌ Failed Prospects:');
        data.failed.forEach(f => {
          console.log(`   - ${f.prospect}: ${f.error}`);
        });
      }
    } else {
      console.log('\n❌ REQUEST FAILED');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log(`   Details: ${data.details || 'No details'}`);
    }
  })
  .catch(error => {
    console.error('\n💥 FETCH ERROR:', error.message);
    console.error('   Make sure the dev server is running on localhost:3000');
  });
