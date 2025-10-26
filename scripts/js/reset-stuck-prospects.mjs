import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetStuckProspects() {
  try {
    const linkedinUrl = 'https://www.linkedin.com/in/skiyer';

    console.log(`\n🔄 Resetting all stuck prospects for: ${linkedinUrl}`);
    console.log('='.repeat(80));

    // Reset ALL prospects with this LinkedIn URL to 'approved' status
    // This includes both 'already_invited' and 'connection_requested' without unipile_message_id
    const { data: updated, error } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'approved',
        contacted_at: null,
        personalization_data: null
      })
      .eq('linkedin_url', linkedinUrl)
      .in('status', ['already_invited', 'connection_requested'])
      .select();

    if (error) throw error;

    console.log(`\n✅ Reset ${updated.length} prospect(s) to 'approved' status`);
    console.log(`   They are now ready to be attempted again with the fixed code\n`);

    // Show which campaigns were affected
    if (updated.length > 0) {
      console.log('📋 Affected Campaigns:');
      const campaigns = [...new Set(updated.map(p => p.campaign_id))];
      for (const campaignId of campaigns) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('name, status')
          .eq('id', campaignId)
          .single();

        if (campaign) {
          const prospectCount = updated.filter(p => p.campaign_id === campaignId).length;
          console.log(`   - ${campaign.name} (${campaign.status}): ${prospectCount} prospect(s)`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetStuckProspects();
