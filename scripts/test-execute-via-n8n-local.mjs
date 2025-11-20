import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function testLocalExecution() {
  console.log('🧪 Testing execute-via-n8n with internal trigger flag...\n');

  // Get a test campaign
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, status')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!campaign) {
    console.error('❌ No active campaigns found');
    return;
  }

  console.log(`📋 Test Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Workspace: ${campaign.workspace_id}\n`);

  console.log('🚀 Calling execute-via-n8n API with internal trigger flag...');

  try {
    const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-via-n8n', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'cron'
      },
      body: JSON.stringify({
        campaignId: campaign.id,
        workspaceId: campaign.workspace_id
      })
    });

    console.log(`\n📡 Response Status: ${response.status}`);

    const data = await response.json();
    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ API call failed');
    } else {
      console.log('\n✅ API call successful');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testLocalExecution().catch(console.error);
