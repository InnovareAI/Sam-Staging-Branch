require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaign() {
  console.log('🔍 CHECKING BLL CISO CAMPAIGN\n');
  console.log('=' .repeat(70));

  // Find the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id')
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
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

  console.log(`📊 TOTAL PROSPECTS: ${prospects?.length || 0}\n`);

  // Count by status
  const statusCounts = {};
  prospects?.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('STATUS BREAKDOWN:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n' + '=' .repeat(70));

  // Show approved prospects
  const approved = prospects?.filter(p => p.status === 'approved');

  if (approved && approved.length > 0) {
    console.log(`\n✅ APPROVED PROSPECTS (${approved.length}) - These will be contacted:\n`);
    approved.forEach((p, i) => {
      const linkedin = p.linkedin_url ? '✅' : '❌ NO URL';
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} ${linkedin}`);
      console.log(`    ${p.title || 'No title'} at ${p.company || 'Unknown'}`);
    });
  }

  // Show NOT approved prospects
  const notApproved = prospects?.filter(p => p.status !== 'approved');

  if (notApproved && notApproved.length > 0) {
    console.log(`\n\n⛔ NOT APPROVED (${notApproved.length}) - These will NOT be contacted:\n`);

    // Group by status
    const rejected = notApproved.filter(p => p.status === 'rejected');
    const pending = notApproved.filter(p => p.status === 'pending');
    const other = notApproved.filter(p => p.status !== 'rejected' && p.status !== 'pending');

    if (rejected.length > 0) {
      console.log(`  REJECTED (${rejected.length}):`);
      rejected.forEach((p, i) => {
        console.log(`    ${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      });
    }

    if (pending.length > 0) {
      console.log(`\n  PENDING (${pending.length}):`);
      pending.forEach((p, i) => {
        console.log(`    ${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      });
    }

    if (other.length > 0) {
      console.log(`\n  OTHER STATUS (${other.length}):`);
      other.forEach((p, i) => {
        console.log(`    ${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} - ${p.status}`);
      });
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total prospects: ${prospects?.length || 0}`);
  console.log(`   ✅ APPROVED: ${approved?.length || 0} (will be contacted)`);
  console.log(`   ⛔ NOT APPROVED: ${notApproved?.length || 0} (will be skipped)\n`);

  // Check if approved prospects have LinkedIn URLs
  const approvedWithoutLinkedIn = approved?.filter(p => !p.linkedin_url);
  if (approvedWithoutLinkedIn && approvedWithoutLinkedIn.length > 0) {
    console.log(`⚠️  WARNING: ${approvedWithoutLinkedIn.length} approved prospects are missing LinkedIn URLs!`);
    approvedWithoutLinkedIn.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
    });
    console.log('');
  }

  console.log(`Campaign ID: ${campaign.id}\n`);
}

checkCampaign().catch(console.error);
