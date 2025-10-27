#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testCampaignExecution() {
  console.log('🧪 Testing campaign execution API directly...\n');

  const AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN;

  if (!AUTH_TOKEN) {
    console.log('❌ SUPABASE_AUTH_TOKEN not set in .env.local');
    console.log('Please set it to your auth token from the browser');
    return;
  }

  const campaignId = 'ac81022c-48f4-4f06-87be-1467175f5b61';
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

    console.log('═══════════════════════════════════════════════════════════');
    console.log('FULL API RESPONSE:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check for enhanced debugging info
    if (data.errors && data.errors.length > 0) {
      console.log('🔍 ENHANCED DEBUG INFO:\n');
      data.errors.forEach((error, i) => {
        console.log(`Error ${i + 1}:`);
        console.log(`   Prospect: ${error.prospect || 'Unknown'}`);
        console.log(`   LinkedIn URL: ${error.linkedin_url || 'N/A'}`);
        console.log(`   LinkedIn ID: ${error.linkedin_identifier || 'N/A'}`);
        console.log(`   Error: ${error.error}`);

        if (error.debug_info) {
          console.log(`\n   Debug Info:`);
          console.log(`      Account Name: ${error.debug_info.account_name}`);
          console.log(`      Base Account ID: ${error.debug_info.account_id_base}`);
          console.log(`      Source Account ID: ${error.debug_info.account_id_source}`);
          console.log(`      Unipile DSN: ${error.debug_info.unipile_dsn}`);
          console.log(`      Profile URL Used: ${error.debug_info.profile_url_used}`);
          console.log(`      Has API Key: ${error.debug_info.has_api_key}`);
        }

        if (error.error_stack) {
          console.log(`\n   Stack Trace:`);
          console.log(`      ${error.error_stack}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No enhanced debugging info in response');
      console.log('This means the deployment might not be live yet\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCampaignExecution().catch(console.error);
