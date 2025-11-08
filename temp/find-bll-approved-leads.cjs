const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findApprovedLeads() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Find the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', wsId)
    .ilike('name', '%20251021-BLL%')
    .single();

  if (!campaign) {
    console.log('Campaign not found. Searching all BLL campaigns...');
    const { data: allCampaigns } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('workspace_id', wsId)
      .ilike('name', '%BLL%');

    console.log('\nFound campaigns:');
    allCampaigns?.forEach(c => console.log(`  - ${c.name}`));
    return;
  }

  console.log(`Campaign: ${campaign.name}`);
  console.log(`ID: ${campaign.id}\n`);

  // Get campaign prospects with APPROVED status only
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  console.log(`Total APPROVED prospects: ${prospects?.length || 0}\n`);

  if (prospects && prospects.length > 0) {
    console.log('APPROVED LEADS FOR REVIEW:\n');
    console.log('='.repeat(70));

    prospects.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Company: ${p.company || 'Unknown'}`);
      console.log(`   Title: ${p.title || 'Unknown'}`);
      console.log(`   LinkedIn: ${p.linkedin_url || 'No URL'}`);
      console.log(`   Status: ${p.status}`);

      // Show personalization data if available
      if (p.personalization_data) {
        const vars = p.personalization_data;
        console.log(`   Variables: FirstName=${vars.firstName || p.first_name}, Company=${vars.company || p.company}, Industry=${vars.industry || 'cybersecurity'}`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\n✅ Total: ${prospects.length} APPROVED leads ready for campaign`);
    console.log(`\nThese will receive:`);
    console.log(`  - Connection request with personalized message`);
    console.log(`  - Follow-up on Day 3, 7, and 14 if no response`);
  } else {
    console.log('No approved prospects found.');

    // Check all statuses
    const { data: allProspects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', campaign.id);

    const statusCount = {};
    allProspects?.forEach(p => {
      statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    });

    console.log('\nProspect status breakdown:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }
}

findApprovedLeads().catch(console.error);
