require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteTestCampaigns() {
  console.log('🗑️  DELETING TEST CAMPAIGNS\n');
  console.log('=' .repeat(70));

  // Get all campaigns with "test" in name
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_at')
    .ilike('name', '%test%')
    .order('created_at', { ascending: false });

  if (!campaigns || campaigns.length === 0) {
    console.log('\n✅ No test campaigns found');
    return;
  }

  console.log(`\n📋 Found ${campaigns.length} test campaign(s):\n`);

  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${new Date(c.created_at).toLocaleDateString()})`);
  });

  console.log('\n🗑️  Deleting campaigns and their prospects...\n');

  for (const campaign of campaigns) {
    // Delete campaign prospects first (foreign key constraint)
    const { error: prospectsError, count: prospectsCount } = await supabase
      .from('campaign_prospects')
      .delete()
      .eq('campaign_id', campaign.id);

    if (prospectsError) {
      console.log(`❌ Error deleting prospects for "${campaign.name}":`, prospectsError.message);
      continue;
    }

    // Delete campaign
    const { error: campaignError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign.id);

    if (campaignError) {
      console.log(`❌ Error deleting campaign "${campaign.name}":`, campaignError.message);
    } else {
      console.log(`✅ Deleted: ${campaign.name} (${prospectsCount || 0} prospects)`);
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log('\n✅ CLEANUP COMPLETE - Fresh slate ready!\n');
}

deleteTestCampaigns().catch(console.error);
