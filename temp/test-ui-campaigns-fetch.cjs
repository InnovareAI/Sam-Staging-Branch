const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUIFetch() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Testing what the UI API call returns...\n');

  // This mimics exactly what the UI does
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${campaigns?.length || 0} total campaigns\n`);

  if (campaigns && campaigns.length > 0) {
    campaigns.forEach(campaign => {
      console.log(`Campaign: ${campaign.name}`);
      console.log(`  ID: ${campaign.id}`);
      console.log(`  Status: ${campaign.status}`);
      console.log(`  Type: ${campaign.campaign_type}`);
      console.log(`  Should show in Inactive tab: ${campaign.status === 'inactive' || campaign.status === 'scheduled' ? 'YES' : 'NO'}`);
      console.log('');
    });
  }

  // Now test with the filter applied (like frontend does)
  const inactiveCampaigns = campaigns.filter(c => c.status === 'inactive' || c.status === 'scheduled');
  console.log(`\nCampaigns that should show in "Inactive" tab: ${inactiveCampaigns.length}`);
  inactiveCampaigns.forEach(c => {
    console.log(`  - ${c.name} (${c.status})`);
  });
}

testUIFetch().catch(console.error);
