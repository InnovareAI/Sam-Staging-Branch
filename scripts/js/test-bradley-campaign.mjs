/**
 * Test Campaign Execution for Bradley Breton
 *
 * This script calls the campaign execution API to send a connection request
 * to Bradley Breton via Irish's LinkedIn account.
 */

const CAMPAIGN_ID = 'd74d38c2-bd2c-4522-b503-72eda6350983';
const API_URL = 'http://localhost:3000/api/campaigns/direct/send-connection-requests';

async function testCampaign() {
  console.log('🚀 Testing campaign execution for Bradley Breton...\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID
      })
    });

    const data = await response.json();

    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', JSON.stringify(data, null, 2));

    if (data.results) {
      console.log('\n📈 Results Summary:');
      data.results.forEach((result, i) => {
        console.log(`\n  ${i + 1}. ${result.name}`);
        console.log(`     Status: ${result.status}`);
        if (result.status === 'success') {
          console.log(`     ✅ Connection request sent!`);
          console.log(`     Next action: ${result.nextActionAt}`);
        } else if (result.status === 'failed') {
          console.log(`     ❌ Failed: ${result.error}`);
          if (result.errorDetails) {
            console.log(`     Error details:`, JSON.stringify(result.errorDetails, null, 2));
          }
        } else if (result.status === 'skipped') {
          console.log(`     ⏭️  Skipped: ${result.reason}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testCampaign();
