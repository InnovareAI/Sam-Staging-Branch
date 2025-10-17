/**
 * Check campaign type and prospect details
 * Run with: node scripts/check-campaign-type.cjs
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCampaign() {
  try {
    console.log('🔍 Checking campaign: 20251017-BA-Outreach Campaign\n');

    // Get campaign details with prospects (most recent if multiple)
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        campaign_type,
        status,
        created_at,
        message_templates,
        campaign_prospects (
          id,
          first_name,
          last_name,
          company_name,
          linkedin_url,
          linkedin_user_id,
          title,
          status
        )
      `)
      .eq('name', '20251017-BA-Outreach Campaign')
      .order('created_at', { ascending: false });

    if (campaignError) {
      console.error('❌ Error fetching campaign:', campaignError);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ Campaign not found');
      return;
    }

    if (campaigns.length > 1) {
      console.log(`⚠️  Found ${campaigns.length} campaigns with this name. Using most recent.\n`);
    }

    const campaign = campaigns[0];
    const prospects = campaign.campaign_prospects || [];

    if (!campaign) {
      console.log('❌ Campaign not found');
      return;
    }

    console.log('📊 Campaign Details:');
    console.log(`   Name: ${campaign.name}`);
    console.log(`   Type: ${campaign.campaign_type || 'NOT SET'}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Total Prospects: ${prospects?.length || 0}\n`);

    console.log('👥 Prospect Details:');
    prospects.forEach((p, index) => {
      console.log(`\n${index + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Company: ${p.company_name || 'N/A'}`);
      console.log(`   Title: ${p.title || 'N/A'}`);
      console.log(`   LinkedIn URL: ${p.linkedin_url || 'N/A'}`);
      console.log(`   LinkedIn User ID: ${p.linkedin_user_id || 'NOT SET'}`);
      console.log(`   Status: ${p.status || 'N/A'}`);
    });

    // Extract LinkedIn profile URLs to check connection degrees
    console.log('\n🔍 Checking connection degrees from LinkedIn URLs...');
    const linkedinUrls = prospects.map(p => p.linkedin_url).filter(Boolean);

    if (linkedinUrls.length === 0) {
      console.log('❌ No LinkedIn URLs found for prospects!');
      return;
    }

    // Recommendation based on campaign setup
    console.log('\n💡 Analysis:');
    console.log(`   Campaign Type: ${campaign.campaign_type || 'NOT SET'}`);
    console.log(`   Total Prospects: ${prospects.length}`);
    console.log(`   Prospects with LinkedIn URLs: ${linkedinUrls.length}`);
    console.log(`   Prospects with User IDs: ${prospects.filter(p => p.linkedin_user_id).length}`);

    if (!campaign.campaign_type) {
      console.log('\n⚠️  Campaign type is NOT SET!');
      console.log('   Set to CONNECTOR for 2nd/3rd degree (connection requests)');
      console.log('   Set to MESSENGER for 1st degree (direct messages)');
    } else if (campaign.campaign_type === 'connector') {
      console.log('\n✅ This is a CONNECTOR campaign (for 2nd/3rd degree)');
      console.log('   - Sends connection requests to prospects');
      console.log('   - Only needs LinkedIn profile URL (has internal ID)')
      console.log('   - No need to sync LinkedIn connections');
      console.log('\n📋 Next steps:');
      console.log('   1. Review prospects have LinkedIn URLs');
      console.log('   2. Launch campaign to send connection requests');
      console.log('   3. Follow-up messages sent after acceptance');
    } else if (campaign.campaign_type === 'messenger') {
      console.log('\n✅ This is a MESSENGER campaign (for 1st degree)');
      console.log('   - Sends direct messages to existing connections');
      console.log('   - Requires LinkedIn Internal IDs from message history');
      console.log('   - Must sync LinkedIn connections first');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCampaign();
