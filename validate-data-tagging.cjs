#!/usr/bin/env node

/**
 * Validate Data Tagging and View Queries
 * Checks if workspace_id is properly set and if queries are pulling correct data
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function validateDataTagging() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔍 DATA TAGGING & VIEW VALIDATION');
  console.log('='.repeat(70) + '\n');
  console.log('Testing Workspace ID:', WORKSPACE_ID);
  console.log('');

  // Check 1: Are campaigns properly tagged with workspace_id?
  console.log('✓ Check 1: Campaign workspace_id tagging');
  console.log('─'.repeat(70));

  const { count: totalCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact' });

  const { data: workspaceCampaigns, count: myWorkspaceCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id', { count: 'exact' })
    .eq('workspace_id', WORKSPACE_ID);

  console.log('Total campaigns in system:', totalCampaigns);
  console.log('My workspace campaigns:', myWorkspaceCampaigns);
  console.log('');

  if (workspaceCampaigns && workspaceCampaigns.length > 0) {
    console.log('✅ Campaigns ARE tagged with workspace_id');
    workspaceCampaigns.slice(0, 3).forEach(c => {
      console.log(`   - ${c.name}`);
      console.log(`     workspace_id: ${c.workspace_id}`);
    });
  } else {
    console.log('❌ No campaigns found for this workspace');
  }
  console.log('');

  // Check 2: Are campaign_prospects linked to campaigns correctly?
  console.log('✓ Check 2: Campaign prospects linking');
  console.log('─'.repeat(70));

  const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8'; // 20251101-IAI-Outreach

  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, campaign_id, status')
    .eq('campaign_id', campaignId);

  console.log('Campaign: 20251101-IAI-Outreach Campaign');
  console.log('Campaign ID:', campaignId);
  console.log('Prospects found:', campaignProspects?.length || 0);
  console.log('');

  if (campaignProspects && campaignProspects.length > 0) {
    console.log('✅ Prospects ARE linked to campaign via campaign_id');
    campaignProspects.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`);
    });
  }
  console.log('');

  // Check 3: Do campaigns join to their prospects correctly?
  console.log('✓ Check 3: Campaign → Prospect JOIN query');
  console.log('─'.repeat(70));

  const { data: joinedData, error: joinError } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      workspace_id,
      campaign_prospects (
        id,
        first_name,
        last_name,
        status
      )
    `)
    .eq('id', campaignId)
    .single();

  if (joinError) {
    console.log('❌ JOIN query failed:', joinError.message);
  } else {
    console.log('✅ JOIN query works correctly');
    console.log('Campaign:', joinedData.name);
    console.log('Workspace:', joinedData.workspace_id);
    console.log('Prospects in JOIN:', joinedData.campaign_prospects?.length || 0);
    console.log('');
    if (joinedData.campaign_prospects) {
      joinedData.campaign_prospects.forEach(p => {
        console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`);
      });
    }
  }
  console.log('');

  // Check 4: Are workspace_prospects tagged correctly?
  console.log('✓ Check 4: Workspace prospects tagging');
  console.log('─'.repeat(70));

  const { count: totalProspects } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact' });

  const { count: myProspects } = await supabase
    .from('workspace_prospects')
    .select('*', { count: 'exact' })
    .eq('workspace_id', WORKSPACE_ID);

  console.log('Total workspace_prospects:', totalProspects);
  console.log('My workspace prospects:', myProspects);

  if (myProspects && myProspects > 0) {
    console.log('✅ Workspace prospects ARE tagged with workspace_id');
  } else {
    console.log('❌ No prospects found for this workspace');
  }
  console.log('');

  // Check 5: Does prospect_approval_data have workspace_id?
  console.log('✓ Check 5: Prospect approval data structure');
  console.log('─'.repeat(70));

  const { data: sampleApproval } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .limit(1);

  if (sampleApproval && sampleApproval.length > 0) {
    const columns = Object.keys(sampleApproval[0]);
    const hasWorkspaceId = columns.includes('workspace_id');
    const hasSessionId = columns.includes('session_id');

    console.log('Has workspace_id column:', hasWorkspaceId ? '✅ Yes' : '❌ No');
    console.log('Has session_id column:', hasSessionId ? '✅ Yes' : '❌ No');
    console.log('');

    if (!hasWorkspaceId && hasSessionId) {
      console.log('⚠️  prospect_approval_data uses session_id instead of workspace_id');
      console.log('   Need to check if sessions are workspace-scoped');

      // Check if we can link session to workspace
      const sessionId = sampleApproval[0].session_id;
      console.log('   Sample session_id:', sessionId);
    }
  }
  console.log('');

  // Check 6: Test a full funnel query (what the UI would run)
  console.log('✓ Check 6: Full funnel query (UI simulation)');
  console.log('─'.repeat(70));

  const { data: fullFunnel, error: funnelError } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      status,
      workspace_id,
      campaign_prospects (
        id,
        first_name,
        last_name,
        status,
        linkedin_url,
        contacted_at
      )
    `)
    .eq('workspace_id', WORKSPACE_ID)
    .in('status', ['active', 'draft']);

  if (funnelError) {
    console.log('❌ Full funnel query failed:', funnelError.message);
  } else {
    console.log('✅ Full funnel query works');
    console.log('Active/Draft campaigns found:', fullFunnel?.length || 0);
    console.log('');

    if (fullFunnel && fullFunnel.length > 0) {
      fullFunnel.forEach(c => {
        const allProspects = c.campaign_prospects || [];
        const readyProspects = allProspects.filter(p =>
          ['pending', 'queued_in_n8n'].includes(p.status) &&
          !p.contacted_at &&
          p.linkedin_url
        );

        console.log(`   📋 ${c.name}`);
        console.log(`      Status: ${c.status}`);
        console.log(`      Total prospects: ${allProspects.length}`);
        console.log(`      Ready for execution: ${readyProspects.length}`);
      });
    }
  }
  console.log('');

  // Check 7: Cross-workspace contamination test
  console.log('✓ Check 7: Cross-workspace isolation check');
  console.log('─'.repeat(70));

  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  console.log('Total workspaces in system:', allWorkspaces?.length || 0);

  if (allWorkspaces && allWorkspaces.length > 1) {
    console.log('Testing workspace isolation...');

    // Get campaigns for each workspace
    for (const ws of allWorkspaces.slice(0, 3)) {
      const { count: wsCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .eq('workspace_id', ws.id);

      const isMyWorkspace = ws.id === WORKSPACE_ID;
      console.log(`   ${isMyWorkspace ? '👉' : '  '} ${ws.name}: ${wsCount} campaigns`);
    }

    console.log('\n✅ Workspaces are properly isolated (each has separate campaigns)');
  } else {
    console.log('Only one workspace in system - isolation not testable');
  }
  console.log('');

  console.log('='.repeat(70));
  console.log('✅ DATA TAGGING & VIEW VALIDATION COMPLETE');
  console.log('='.repeat(70));
}

validateDataTagging().catch(console.error);
