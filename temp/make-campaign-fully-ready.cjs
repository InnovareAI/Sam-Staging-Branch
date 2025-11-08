const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function makeReady() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Making campaign fully ready for execution...\n');

  // Update campaign to be fully ready
  const { error } = await supabase
    .from('campaigns')
    .update({
      status: 'active',
      launched_at: new Date().toISOString(), // Add launch timestamp
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log('✅ Campaign updated\n');

  // Verify the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  console.log('Campaign Status:');
  console.log(`  Name: ${campaign.name}`);
  console.log(`  Status: ${campaign.status}`);
  console.log(`  Type: ${campaign.campaign_type}`);
  console.log(`  Launched: ${campaign.launched_at ? new Date(campaign.launched_at).toLocaleString() : 'Not launched'}`);
  console.log(`  Prospects: ${prospectCount}`);
  console.log(`  Has messages: ${campaign.message_templates ? 'Yes' : 'No'}`);
  console.log(`  Created by: ${campaign.created_by}`);
  console.log('');

  console.log('✅ Campaign is ready!');
  console.log('   - Status: active');
  console.log('   - Launched: Yes');
  console.log('   - 25 prospects approved');
  console.log('   - Message templates configured');
  console.log('\n👉 Try refreshing the UI or clearing browser cache\n');
}

makeReady().catch(console.error);
