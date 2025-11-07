require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findStanProspects() {
  console.log('🔍 SEARCHING STAN\'S WORKSPACE DATA\n');
  console.log('=' .repeat(70));

  // First, find Stan's workspace by looking at the campaign we know exists
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('workspace_id, name')
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  if (!campaign) {
    console.log('❌ Could not find campaign to determine workspace');
    return;
  }

  const workspaceId = campaign.workspace_id;
  console.log(`\n✅ Found workspace ID: ${workspaceId}`);
  console.log(`   Campaign: ${campaign.name}\n`);

  // Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, company_name')
    .eq('id', workspaceId)
    .single();

  console.log(`📊 Workspace: ${workspace?.name || 'Unknown'}`);
  console.log(`   Company: ${workspace?.company_name || 'N/A'}\n`);

  console.log('=' .repeat(70));

  // Search for all prospects in this workspace
  const { data: allProspects, count: totalCount } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  console.log(`\n📋 Total prospects in workspace: ${totalCount || 0}\n`);

  if (!allProspects || allProspects.length === 0) {
    console.log('⚠️  No prospects found in workspace\n');
    return;
  }

  // Look for CISO/cybersecurity related prospects
  const cisoProspects = allProspects.filter(p => {
    const title = (p.title || '').toLowerCase();
    const company = (p.company || '').toLowerCase();
    const industry = (p.industry || '').toLowerCase();

    return title.includes('ciso') ||
           title.includes('chief information security') ||
           title.includes('security') ||
           industry.includes('cybersecurity') ||
           industry.includes('cyber security');
  });

  console.log(`🎯 Found ${cisoProspects.length} CISO/Security related prospects\n`);

  // Group by approval status
  const approved = cisoProspects.filter(p => p.approval_status === 'approved');
  const rejected = cisoProspects.filter(p => p.approval_status === 'rejected');
  const pending = cisoProspects.filter(p => !p.approval_status || p.approval_status === 'pending');

  console.log('STATUS BREAKDOWN:');
  console.log(`  ✅ Approved: ${approved.length}`);
  console.log(`  ⛔ Rejected: ${rejected.length}`);
  console.log(`  ⏳ Pending: ${pending.length}\n`);

  console.log('=' .repeat(70));

  // Show approved prospects
  if (approved.length > 0) {
    console.log(`\n✅ APPROVED PROSPECTS (${approved.length}):\n`);
    approved.forEach((p, i) => {
      const linkedin = p.linkedin_url ? '✅' : '❌';
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} ${linkedin}`);
      console.log(`    ${p.title || 'No title'}`);
      console.log(`    ${p.company || 'Unknown company'}`);
      console.log(`    Approval: ${p.approval_status} | Created: ${new Date(p.created_at).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Show rejected prospects
  if (rejected.length > 0) {
    console.log(`\n⛔ REJECTED PROSPECTS (${rejected.length}):\n`);
    rejected.forEach((p, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      console.log(`    ${p.title || 'No title'} at ${p.company || 'Unknown'}`);
    });
  }

  // Show pending prospects
  if (pending.length > 0) {
    console.log(`\n\n⏳ PENDING REVIEW (${pending.length}):\n`);
    pending.forEach((p, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      console.log(`    ${p.title || 'No title'} at ${p.company || 'Unknown'}`);
    });
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total CISO/Security prospects: ${cisoProspects.length}`);
  console.log(`   ✅ Approved: ${approved.length}`);
  console.log(`   ⛔ Rejected: ${rejected.length}`);
  console.log(`   ⏳ Pending: ${pending.length}`);
  console.log(`\n   Workspace ID: ${workspaceId}`);
  console.log(`   Campaign ID: ${campaign.id}\n`);

  // Check if any are already in campaign_prospects
  const { count: inCampaign } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  console.log(`\n⚠️  Currently in campaign: ${inCampaign || 0} prospects`);

  if (approved.length > 0 && inCampaign === 0) {
    console.log(`\n💡 ACTION NEEDED: ${approved.length} approved prospects need to be added to campaign`);
  }
}

findStanProspects().catch(console.error);
