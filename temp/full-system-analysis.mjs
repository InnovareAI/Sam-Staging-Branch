import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  console.log('=== FULL SYSTEM ANALYSIS ===\n');

  // 1. Workspaces without members
  const { data: workspaces } = await supabase.from('workspaces').select('id, name, owner_id');
  const { data: members } = await supabase.from('workspace_members').select('workspace_id, user_id');

  console.log('1. WORKSPACE MEMBERS');
  console.log('   Total workspaces:', workspaces?.length);
  console.log('   Total memberships:', members?.length);
  if (!members || members.length === 0) {
    console.log('   ❌ BROKEN: workspace_members is EMPTY - no user can access any workspace');
  }

  // 2. Campaigns with invalid linkedin_account_id
  const { data: campaigns } = await supabase.from('campaigns').select('id, name, linkedin_account_id, workspace_id, status');
  const { data: accounts } = await supabase.from('user_unipile_accounts').select('id, workspace_id, account_name, connection_status');

  const accountIds = new Set((accounts || []).map(a => a.id));
  const brokenCampaigns = (campaigns || []).filter(c => c.linkedin_account_id && !accountIds.has(c.linkedin_account_id));

  console.log('\n2. CAMPAIGNS WITH INVALID LINKEDIN ACCOUNT');
  console.log('   Total campaigns:', campaigns?.length);
  console.log('   Campaigns with broken linkedin_account_id:', brokenCampaigns.length);
  if (brokenCampaigns.length > 0) {
    console.log('   ❌ BROKEN campaigns:');
    for (const c of brokenCampaigns.slice(0, 10)) {
      console.log('      -', c.name, '(' + c.status + ')');
    }
  }

  // 3. Accounts without workspace_id
  const accountsNoWorkspace = (accounts || []).filter(a => !a.workspace_id);
  console.log('\n3. ACCOUNTS WITHOUT WORKSPACE');
  console.log('   Total accounts:', accounts?.length);
  console.log('   Accounts without workspace_id:', accountsNoWorkspace.length);
  if (accountsNoWorkspace.length > 0) {
    console.log('   ⚠️ These accounts cannot be used:');
    for (const a of accountsNoWorkspace) {
      console.log('      -', a.account_name);
    }
  }

  // 4. Disconnected accounts
  const disconnected = (accounts || []).filter(a => a.connection_status !== 'active');
  console.log('\n4. DISCONNECTED ACCOUNTS');
  console.log('   Disconnected/inactive:', disconnected.length);
  for (const a of disconnected) {
    console.log('   ⚠️', a.account_name, '-', a.connection_status);
  }

  // 5. Send queue issues
  const { data: queue } = await supabase.from('send_queue').select('status, error_message').limit(1000);
  const queueByStatus = {};
  for (const q of (queue || [])) {
    queueByStatus[q.status] = (queueByStatus[q.status] || 0) + 1;
  }
  console.log('\n5. SEND QUEUE STATUS');
  console.log('   ', queueByStatus);
  const failed = (queue || []).filter(q => q.status === 'failed');
  if (failed.length > 0) {
    console.log('   ❌ Failed items:', failed.length);
  }

  // 6. Prospect approval data stuck
  const { data: approvals } = await supabase.from('prospect_approval_data').select('status').limit(1000);
  const approvalByStatus = {};
  for (const a of (approvals || [])) {
    approvalByStatus[a.status] = (approvalByStatus[a.status] || 0) + 1;
  }
  console.log('\n6. PROSPECT APPROVAL DATA');
  console.log('   ', approvalByStatus);

  // 7. Campaign prospects stuck
  const { data: prospects } = await supabase.from('campaign_prospects').select('status').limit(5000);
  const prospectByStatus = {};
  for (const p of (prospects || [])) {
    prospectByStatus[p.status] = (prospectByStatus[p.status] || 0) + 1;
  }
  console.log('\n7. CAMPAIGN PROSPECTS STATUS');
  console.log('   ', prospectByStatus);

  // 8. Slack integrations
  const { data: slack } = await supabase.from('slack_app_config').select('workspace_id, status, slack_team_name');
  console.log('\n8. SLACK INTEGRATIONS');
  console.log('   Total:', slack?.length);
  for (const s of (slack || [])) {
    console.log('   -', s.slack_team_name, '-', s.status);
  }

  // 9. Check for orphaned data
  const workspaceIds = new Set((workspaces || []).map(w => w.id));
  const campaignsOrphaned = (campaigns || []).filter(c => !workspaceIds.has(c.workspace_id));
  console.log('\n9. ORPHANED CAMPAIGNS (no workspace)');
  console.log('   Count:', campaignsOrphaned.length);

  // 10. Paused campaigns that should be running
  const pausedCampaigns = (campaigns || []).filter(c => c.status === 'paused');
  console.log('\n10. PAUSED CAMPAIGNS');
  console.log('   Count:', pausedCampaigns.length);
  for (const c of pausedCampaigns) {
    console.log('   -', c.name);
  }

  console.log('\n=== SUMMARY OF ISSUES TO FIX ===\n');

  let issues = 0;

  if (!members || members.length === 0) {
    issues++;
    console.log('❌ 1. workspace_members table is EMPTY');
  }

  if (brokenCampaigns.length > 0) {
    issues++;
    console.log('❌ 2.', brokenCampaigns.length, 'campaigns have invalid linkedin_account_id');
  }

  if (accountsNoWorkspace.length > 0) {
    issues++;
    console.log('❌ 3.', accountsNoWorkspace.length, 'accounts have no workspace_id');
  }

  if (disconnected.length > 0) {
    issues++;
    console.log('⚠️ 4.', disconnected.length, 'accounts are disconnected');
  }

  if (failed.length > 0) {
    issues++;
    console.log('❌ 5.', failed.length, 'items failed in send_queue');
  }

  console.log('\nTotal issues:', issues);
}

analyze().catch(console.error);
