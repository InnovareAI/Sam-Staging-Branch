const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPI() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Simulating what the UI API call returns...\n');

  // This is what the API does
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      description,
      campaign_type,
      type,
      status,
      launched_at,
      created_at,
      updated_at
    `)
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`Found ${campaigns?.length || 0} campaigns\n`);

  if (campaigns && campaigns.length > 0) {
    for (const campaign of campaigns) {
      // Get prospect count
      const { count: prospectCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      console.log(`Campaign: ${campaign.name}`);
      console.log(`  ID: ${campaign.id}`);
      console.log(`  Status: ${campaign.status}`);
      console.log(`  Type: ${campaign.campaign_type || campaign.type}`);
      console.log(`  Prospects: ${prospectCount || 0}`);
      console.log(`  Created: ${new Date(campaign.created_at).toLocaleString()}`);
      console.log('');
    }
  } else {
    console.log('❌ NO CAMPAIGNS RETURNED BY API\n');
  }
}

testAPI().catch(console.error);
