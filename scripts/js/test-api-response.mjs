#!/usr/bin/env node

const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
const apiUrl = 'https://app.meet-sam.com';

async function testApiResponse() {
  try {
    console.log('🔍 Testing API response from production...\n');
    console.log(`URL: ${apiUrl}/api/campaigns/${campaignId}/prospects\n`);

    const response = await fetch(`${apiUrl}/api/campaigns/${campaignId}/prospects`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.log('❌ API returned error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();

    console.log(`✅ API returned ${data.prospects?.length || 0} prospects\n`);

    // Find Candy Alexander
    const candy = data.prospects?.find(p =>
      p.first_name === 'Candy' && p.last_name?.includes('Alexander')
    );

    if (candy) {
      console.log('Found Candy Alexander:');
      console.log('  title:', candy.title);
      console.log('  company_name:', candy.company_name);
      console.log('  company:', candy.company);
      console.log('  updated_at:', candy.updated_at);
      console.log('\n  Full object:', JSON.stringify(candy, null, 2));
    } else {
      console.log('❌ Candy Alexander not found in API response');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testApiResponse();
