import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetProspectStatus() {
  try {
    // Get the most recent campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (campaignError) throw campaignError;

    console.log(`\n🔄 Resetting prospects for campaign: ${campaign.name}`);
    console.log(`   Campaign ID: ${campaign.id}\n`);

    // Update all prospects with 'already_invited' status to 'approved'
    const { data: updated, error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'approved',
        contacted_at: null,
        personalization_data: null
      })
      .eq('campaign_id', campaign.id)
      .eq('status', 'already_invited')
      .select();

    if (updateError) throw updateError;

    console.log(`✅ Reset ${updated.length} prospect(s) from 'already_invited' to 'approved'`);

    if (updated.length > 0) {
      console.log('\n📋 Updated Prospects:');
      updated.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.first_name || 'Unknown'} ${p.last_name || 'Unknown'}`);
        console.log(`      LinkedIn: ${p.linkedin_url || 'N/A'}`);
        console.log(`      New Status: ${p.status}\n`);
      });
    }

    console.log('✅ Prospects are now ready to be processed by the campaign\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetProspectStatus();
