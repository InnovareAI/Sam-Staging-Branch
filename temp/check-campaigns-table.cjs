const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaigns() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('Checking campaigns table for BLL workspace...\n');

  // Get all campaigns
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`Total campaigns in database: ${campaigns?.length || 0}\n`);

  if (campaigns && campaigns.length > 0) {
    campaigns.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name || 'Unnamed'}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Type: ${c.campaign_type}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('❌ NO CAMPAIGNS FOUND IN DATABASE\n');
  }

  // Check if the specific campaign exists
  const campaignName = '20251106-BLL-CISO Outreach - Mid Market';
  const { data: specificCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('name', campaignName)
    .single();

  console.log('═══════════════════════════════════════════════════════════════════════');
  if (specificCampaign) {
    console.log(`✅ Campaign "${campaignName}" EXISTS`);
    console.log(`   ID: ${specificCampaign.id}`);
    console.log(`   Status: ${specificCampaign.status}`);
  } else {
    console.log(`❌ Campaign "${campaignName}" DOES NOT EXIST`);
    console.log('   THIS CAMPAIGN WAS NEVER CREATED!');
  }
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

checkCampaigns().catch(console.error);
