require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBLLCampaign() {
  console.log('🔍 CHECKING BLL CISO CAMPAIGN\n');
  console.log('=' .repeat(70));

  // Find the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id')
    .ilike('name', '%20251021-BLL%')
    .single();

  if (!campaign) {
    console.log('\n❌ Campaign not found');
    return;
  }

  console.log(`\n✅ Found: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}\n`);

  // Get all prospects with status breakdown
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company, title, status, linkedin_url')
    .eq('campaign_id', campaign.id)
    .order('status', { ascending: true })
    .order('last_name', { ascending: true });

  // Count by status
  const statusCounts = {};
  prospects?.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('📊 STATUS BREAKDOWN:\n');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} prospects`);
  });

  console.log('\n' + '=' .repeat(70));

  // Show approved prospects
  const approved = prospects?.filter(p => p.status === 'approved');

  if (approved && approved.length > 0) {
    console.log(`\n✅ APPROVED PROSPECTS (${approved.length}):\n`);
    approved.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   ${p.title || 'No title'} at ${p.company || 'Unknown'}`);
      console.log(`   LinkedIn: ${p.linkedin_url ? '✅' : '❌ Missing'}`);
      console.log('');
    });
  }

  // Show rejected/pending prospects
  const notApproved = prospects?.filter(p => p.status !== 'approved');

  if (notApproved && notApproved.length > 0) {
    console.log(`\n⚠️  NOT APPROVED (${notApproved.length}):\n`);
    notApproved.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name} - Status: ${p.status}`);
    });
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📋 TOTAL: ${prospects?.length || 0} prospects`);
  console.log(`✅ APPROVED: ${approved?.length || 0} (ready to send)`);
  console.log(`⚠️  NOT APPROVED: ${notApproved?.length || 0} (will NOT be sent)\n`);

  // Check if approved prospects have LinkedIn URLs
  const approvedWithoutLinkedIn = approved?.filter(p => !p.linkedin_url);
  if (approvedWithoutLinkedIn && approvedWithoutLinkedIn.length > 0) {
    console.log(`⚠️  WARNING: ${approvedWithoutLinkedIn.length} approved prospects are missing LinkedIn URLs!`);
    approvedWithoutLinkedIn.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
    });
  }
}

checkBLLCampaign().catch(console.error);
