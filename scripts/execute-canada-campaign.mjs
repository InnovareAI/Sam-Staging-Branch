import { config } from 'dotenv';

config({ path: '.env.local' });

const CAMPAIGN_ID = '4486cc53-3c8a-47d2-a88c-3dd69db5a17e';
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

async function executeCampaign() {
  console.log('🚀 Executing New Campaign-Canada...\n');
  console.log(`Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`Workspace ID: ${WORKSPACE_ID}\n`);

  try {
    const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-via-n8n', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID
      })
    });

    console.log(`Response Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Campaign execution triggered successfully!');
    } else {
      console.log('\n❌ Campaign execution failed!');
      console.log('Error:', data.error || data.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

executeCampaign();
