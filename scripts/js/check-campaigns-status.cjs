const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔍 Checking existing campaigns...\n');
    
    // Get campaigns list
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, campaign_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (campaignsError) {
      console.log('❌ Error fetching campaigns:', campaignsError);
      return;
    }
    
    if (campaigns?.length > 0) {
      console.log('📊 Recent Campaigns:');
      campaigns.forEach(campaign => {
        console.log(`  • ${campaign.name} (${campaign.campaign_type}) - ${campaign.status} - ${campaign.created_at}`);
      });
    } else {
      console.log('📭 No campaigns found');
    }
    
    // Check campaign prospects table
    console.log('\n🎯 Checking campaign prospects...');
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, campaign_id, first_name, last_name, company_name, status')
      .limit(5);
    
    if (prospectsError) {
      console.log('❌ Error fetching prospects:', prospectsError);
    } else {
      console.log(`📈 Found ${prospects?.length || 0} prospect records`);
    }
    
    // Check workspace tiers
    console.log('\n🏢 Checking workspace configuration...');
    const { data: tiers, error: tiersError } = await supabase
      .from('workspace_tiers')
      .select('workspace_id, tier, created_at');
    
    if (tiersError) {
      console.log('❌ Error fetching workspace tiers:', tiersError);
    } else {
      console.log(`🎚️ Found ${tiers?.length || 0} workspace tier configurations`);
      tiers?.forEach(tier => {
        console.log(`  • Workspace ${tier.workspace_id}: ${tier.tier} tier`);
      });
    }
    
    console.log('\n✅ Database check complete');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
})();