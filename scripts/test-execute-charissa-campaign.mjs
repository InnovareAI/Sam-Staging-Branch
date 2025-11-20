import { config } from 'dotenv';

config({ path: '.env.local' });

async function testExecuteCharissaCampaign() {
  console.log('🧪 Testing direct execution of Charissa New Campaign-Canada...\n');

  const campaignId = '4486cc53-3c8a-47d2-a88c-3dd69db5a17e'; // New Campaign-Canada
  const workspaceId = '7f0341da-88db-476b-ae0a-fc0da5b70861';

  console.log(`📋 Campaign ID: ${campaignId}`);
  console.log(`   Workspace ID: ${workspaceId}\n`);

  console.log('🚀 Calling execute-via-n8n with internal trigger flag...');

  try {
    const response = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'cron'
      },
      body: JSON.stringify({
        campaignId,
        workspaceId
      })
    });

    console.log(`\n📡 Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('\n✅ Success!');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testExecuteCharissaCampaign().catch(console.error);
