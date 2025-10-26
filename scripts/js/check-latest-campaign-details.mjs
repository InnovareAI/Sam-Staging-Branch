import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestCampaign() {
  try {
    // Get the most recent campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (campaignError) throw campaignError;

    console.log(`\n📊 Campaign: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Type: ${campaign.campaign_type || 'N/A'}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}\n`);

    // Get ALL prospects for this campaign (regardless of status)
    const { data: allProspects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (prospectsError) throw prospectsError;

    console.log(`📋 Total Prospects: ${allProspects.length}\n`);

    if (allProspects.length === 0) {
      console.log('❌ NO PROSPECTS FOUND - Campaign has no prospects added!\n');
      return;
    }

    // Group by status
    const statusGroups = allProspects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Prospects by Status:');
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n🔍 Expected Statuses for Execution:');
    console.log('   - pending');
    console.log('   - approved');
    console.log('   - ready_to_message');
    console.log('   - follow_up_due');

    const executableCount = allProspects.filter(p =>
      ['pending', 'approved', 'ready_to_message', 'follow_up_due'].includes(p.status)
    ).length;

    console.log(`\n✅ Executable Prospects: ${executableCount}/${allProspects.length}`);

    if (executableCount === 0) {
      console.log('\n❌ NO EXECUTABLE PROSPECTS!');
      console.log('   All prospects are in non-executable status');
      console.log('   This is why you see "No prospects ready for messaging"\n');
    }

    // Show details of first few prospects
    console.log('\n👥 First 3 Prospects:');
    allProspects.slice(0, 3).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.first_name || 'Unknown'} ${p.last_name || 'Unknown'}`);
      console.log(`   Company: ${p.company_name || 'N/A'}`);
      console.log(`   LinkedIn: ${p.linkedin_url || 'N/A'}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Executable: ${['pending', 'approved', 'ready_to_message', 'follow_up_due'].includes(p.status) ? '✅ YES' : '❌ NO'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLatestCampaign();
