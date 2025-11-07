require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteStanCampaigns() {
  console.log('🗑️  DELETING STAN\'S CAMPAIGNS\n');
  console.log('=' .repeat(70));

  const campaignNames = [
    '20251101-IAI-Outreach Campaign',
    '20251030-IAI-Outreach Campaign'
  ];

  for (const name of campaignNames) {
    // Find campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('name', name)
      .single();

    if (!campaign) {
      console.log(`\n❌ Campaign not found: ${name}`);
      continue;
    }

    console.log(`\n📋 Found: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);

    // Delete prospects first
    const { error: prospectsError, count } = await supabase
      .from('campaign_prospects')
      .delete()
      .eq('campaign_id', campaign.id);

    if (prospectsError) {
      console.log(`   ❌ Error deleting prospects:`, prospectsError.message);
      continue;
    }

    console.log(`   ✅ Deleted ${count || 0} prospects`);

    // Delete campaign
    const { error: campaignError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign.id);

    if (campaignError) {
      console.log(`   ❌ Error deleting campaign:`, campaignError.message);
    } else {
      console.log(`   ✅ Campaign deleted`);
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n✅ CLEANUP COMPLETE\n');
}

deleteStanCampaigns().catch(console.error);
