import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSingleProspect() {
  console.log('🧪 TESTING CAMPAIGN EXECUTION WITH 1 PROSPECT\n');
  console.log('='.repeat(60));

  // Get Charissa's "New Campaign-Canada" campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id')
    .ilike('name', '%New Campaign-Canada%')
    .single();

  if (!campaign) {
    console.error('❌ Campaign not found');
    process.exit(1);
  }

  console.log(`\n📋 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Workspace: ${campaign.workspace_id}`);

  // Get one pending prospect
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .limit(1);

  if (!prospects || prospects.length === 0) {
    console.error('\n❌ No pending prospects found');
    process.exit(1);
  }

  const prospect = prospects[0];
  console.log(`\n👤 Test Prospect: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`   ID: ${prospect.id}`);
  console.log(`   Status: ${prospect.status}`);
  console.log(`   LinkedIn: ${prospect.linkedin_url}`);

  // Call the execute API
  console.log('\n🚀 Calling API: /api/campaigns/linkedin/execute-via-n8n');
  console.log('-'.repeat(60));

  try {
    const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-via-n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        workspaceId: campaign.workspace_id
      })
    });

    const data = await response.json();

    console.log(`\n📡 API Response: ${response.status}`);
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ API call failed');
      process.exit(1);
    }

    console.log('\n✅ API call successful');

    // Wait 5 seconds for database to update
    console.log('\n⏳ Waiting 5 seconds for database update...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check prospect status changed
    const { data: updatedProspect } = await supabase
      .from('campaign_prospects')
      .select('status, contacted_at')
      .eq('id', prospect.id)
      .single();

    console.log('\n📊 Updated Prospect Status:');
    console.log(`   Status: ${updatedProspect.status}`);
    console.log(`   Contacted: ${updatedProspect.contacted_at || 'Not yet'}`);

    if (updatedProspect.status === 'queued_in_n8n') {
      console.log('\n✅✅✅ SUCCESS! Prospect queued in N8N');
      console.log('\n📝 Next steps:');
      console.log('   1. Check N8N execution logs');
      console.log('   2. Wait for randomizer delay');
      console.log('   3. Check LinkedIn for CR');
      console.log('   4. Verify prospect status changes to "connection_request_sent"');
    } else if (updatedProspect.status === 'pending') {
      console.log('\n⚠️  WARNING: Prospect still pending');
      console.log('   N8N may not have received the payload');
      console.log('   Check N8N logs for errors');
    } else {
      console.log(`\n✅ Status changed to: ${updatedProspect.status}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST COMPLETE');
}

testSingleProspect().catch(console.error);
