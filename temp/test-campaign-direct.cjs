#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testCampaignDirect() {
  console.log('🧪 Testing campaign execution endpoint directly...\n');

  // You need to get your auth token from browser
  // Go to app.meet-sam.com, open DevTools (F12), go to Application tab,
  // find "sb-latxadqrvrrrcvkktrog-auth-token" cookie and copy its value

  const AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN || 'PASTE_YOUR_AUTH_TOKEN_HERE';

  if (AUTH_TOKEN === 'PASTE_YOUR_AUTH_TOKEN_HERE') {
    console.log('❌ You need to set SUPABASE_AUTH_TOKEN in .env.local');
    console.log('   Or paste your auth token in this script');
    console.log('\n📝 To get your auth token:');
    console.log('   1. Go to app.meet-sam.com');
    console.log('   2. Open DevTools (F12)');
    console.log('   3. Go to Application tab');
    console.log('   4. Find "sb-latxadqrvrrrcvkktrog-auth-token" cookie');
    console.log('   5. Copy its value and set SUPABASE_AUTH_TOKEN in .env.local');
    return;
  }

  const campaignId = 'ac81022c-48f4-4f06-87be-1467175f5b61'; // 20251027-IAI-Outreach Campaign

  const url = 'https://app.meet-sam.com/api/campaigns/linkedin/execute-live';

  console.log(`📤 POST ${url}`);
  console.log(`   Campaign ID: ${campaignId}`);
  console.log(`   Max Prospects: 1 (testing)\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Cookie': `sb-latxadqrvrrrcvkktrog-auth-token=${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        campaignId: campaignId,
        maxProspects: 1
      })
    });

    console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (data.summary) {
      console.log('\n📊 Summary:');
      console.log(`   Sent: ${data.summary.sent || 0}`);
      console.log(`   Failed: ${data.summary.failed || 0}`);
      console.log(`   Queued: ${data.summary.queued || 0}`);
    }

    if (data.results && data.results.length > 0) {
      console.log('\n📝 Results:');
      data.results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.prospectName || '(no name)'}: ${result.status}`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCampaignDirect().catch(console.error);
