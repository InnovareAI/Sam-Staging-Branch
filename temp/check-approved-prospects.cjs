const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkApproved() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const sessionId = '48594bda-c25b-444c-add2-f6d3170cce99';

  console.log('Checking what happened to the approved prospects...\n');

  // Check session status
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (session) {
    console.log('Session status:');
    console.log(`  Campaign: ${session.campaign_name}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Total: ${session.total_prospects}`);
    console.log(`  Approved: ${session.approved_count}`);
    console.log(`  Rejected: ${session.rejected_count}`);
    console.log(`  Pending: ${session.pending_count}\n`);
  }

  // Check all prospects in this session
  const { data: allProspects } = await supabase
    .from('prospect_approval_data')
    .select('id, name, approval_status')
    .eq('session_id', sessionId);

  console.log(`Total prospects in session: ${allProspects?.length || 0}`);

  if (allProspects && allProspects.length > 0) {
    const statusCounts = {};
    allProspects.forEach(p => {
      statusCounts[p.approval_status] = (statusCounts[p.approval_status] || 0) + 1;
    });

    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\nFirst 5 prospects:');
    allProspects.slice(0, 5).forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name} - ${p.approval_status}`);
    });
  }

  // Check prospect_approval_decisions table
  const { data: decisions } = await supabase
    .from('prospect_approval_decisions')
    .select('*')
    .eq('session_id', sessionId);

  console.log(`\n\nDecisions recorded: ${decisions?.length || 0}`);

  if (decisions && decisions.length > 0) {
    const decisionCounts = {};
    decisions.forEach(d => {
      decisionCounts[d.decision] = (decisionCounts[d.decision] || 0) + 1;
    });

    console.log('Decision breakdown:');
    Object.entries(decisionCounts).forEach(([decision, count]) => {
      console.log(`  ${decision}: ${count}`);
    });
  }

  // Check if they were added to campaign_prospects
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', wsId)
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  if (campaign) {
    const { data: campaignProspects } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status')
      .eq('campaign_id', campaign.id);

    console.log(`\n\nCampaign prospects: ${campaignProspects?.length || 0}`);

    if (campaignProspects && campaignProspects.length > 0) {
      const campaignStatusCounts = {};
      campaignProspects.forEach(p => {
        campaignStatusCounts[p.status] = (campaignStatusCounts[p.status] || 0) + 1;
      });

      console.log('Campaign prospect status:');
      Object.entries(campaignStatusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');
}

checkApproved().catch(console.error);
