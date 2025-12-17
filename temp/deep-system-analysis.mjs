import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  console.log('=== DEEP SYSTEM ANALYSIS ===\n');

  // 1. Check Unipile accounts vs database accounts
  console.log('1. UNIPILE vs DATABASE SYNC');
  const dsn = 'api6.unipile.com:13670';
  const apiKey = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';

  const response = await fetch(`https://${dsn}/api/v1/accounts`, {
    headers: { 'X-API-KEY': apiKey }
  });
  const unipileData = await response.json();
  const unipileAccounts = unipileData.items || [];

  const { data: dbAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_name, workspace_id');

  const dbUnipileIds = new Set((dbAccounts || []).map(a => a.unipile_account_id));

  const missingInDb = unipileAccounts.filter(a => !dbUnipileIds.has(a.id));
  console.log(`   Unipile accounts: ${unipileAccounts.length}`);
  console.log(`   Database accounts: ${dbAccounts?.length || 0}`);
  console.log(`   Missing in DB: ${missingInDb.length}`);
  for (const a of missingInDb) {
    console.log(`   ❌ ${a.name || a.id} not in database`);
  }

  // 2. Check for duplicate accounts
  console.log('\n2. DUPLICATE ACCOUNTS');
  const accountCounts = {};
  for (const a of (dbAccounts || [])) {
    accountCounts[a.unipile_account_id] = (accountCounts[a.unipile_account_id] || 0) + 1;
  }
  const duplicates = Object.entries(accountCounts).filter(([_, count]) => count > 1);
  console.log(`   Duplicate unipile_account_ids: ${duplicates.length}`);
  for (const [id, count] of duplicates) {
    console.log(`   ⚠️ ${id} appears ${count} times`);
  }

  // 3. Check prospect status anomalies
  console.log('\n3. PROSPECT STATUS ANOMALIES');
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, status, campaign_id, created_at, updated_at');

  const oldApproved = (prospects || []).filter(p => {
    if (p.status !== 'approved') return false;
    const updated = new Date(p.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now - updated) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24;
  });
  console.log(`   Approved prospects stuck >24h: ${oldApproved.length}`);

  // 4. Check send_queue anomalies
  console.log('\n4. SEND QUEUE ANOMALIES');
  const { data: queue } = await supabase
    .from('send_queue')
    .select('id, status, scheduled_for, campaign_id, error_message');

  const now = new Date();
  const stuckPending = (queue || []).filter(q => {
    if (q.status !== 'pending') return false;
    const scheduled = new Date(q.scheduled_for);
    return scheduled < now;
  });
  console.log(`   Stuck pending (past scheduled time): ${stuckPending.length}`);

  const errorMessages = {};
  for (const q of (queue || []).filter(q => q.error_message)) {
    const msg = q.error_message.substring(0, 50);
    errorMessages[msg] = (errorMessages[msg] || 0) + 1;
  }
  if (Object.keys(errorMessages).length > 0) {
    console.log('   Error breakdown:');
    for (const [msg, count] of Object.entries(errorMessages)) {
      console.log(`     - "${msg}": ${count}`);
    }
  }

  // 5. Check campaigns without prospects
  console.log('\n5. CAMPAIGNS WITHOUT PROSPECTS');
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status');

  const { data: prospectCounts } = await supabase
    .from('campaign_prospects')
    .select('campaign_id');

  const campaignProspectCounts = {};
  for (const p of (prospectCounts || [])) {
    campaignProspectCounts[p.campaign_id] = (campaignProspectCounts[p.campaign_id] || 0) + 1;
  }

  const activeCampaignsNoProspects = (campaigns || []).filter(c =>
    c.status === 'active' && !campaignProspectCounts[c.id]
  );
  console.log(`   Active campaigns with 0 prospects: ${activeCampaignsNoProspects.length}`);
  for (const c of activeCampaignsNoProspects) {
    console.log(`   ⚠️ ${c.name}`);
  }

  // 6. Check paused campaigns that should maybe be active
  console.log('\n6. PAUSED CAMPAIGNS');
  const pausedCampaigns = (campaigns || []).filter(c => c.status === 'paused');
  console.log(`   Total paused: ${pausedCampaigns.length}`);
  for (const c of pausedCampaigns) {
    const prospectCount = campaignProspectCounts[c.id] || 0;
    console.log(`   - ${c.name} (${prospectCount} prospects)`);
  }

  // 7. Check workspace-account mismatches
  console.log('\n7. WORKSPACE-ACCOUNT ALIGNMENT');
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id');

  const wsOwners = {};
  for (const ws of (workspaces || [])) {
    wsOwners[ws.id] = ws.owner_id;
  }

  const { data: fullAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, user_id, workspace_id, account_name');

  const misaligned = (fullAccounts || []).filter(a => {
    if (!a.workspace_id) return false;
    const wsOwner = wsOwners[a.workspace_id];
    return wsOwner && wsOwner !== a.user_id;
  });

  // This is actually OK - accounts can be shared across workspaces
  // Just report for visibility
  console.log(`   Accounts in workspaces they don't own: ${misaligned.length}`);

  // 8. Check for missing cron activity
  console.log('\n8. RECENT QUEUE ACTIVITY');
  const { data: recentSent } = await supabase
    .from('send_queue')
    .select('id, sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1);

  if (recentSent && recentSent.length > 0) {
    const lastSent = new Date(recentSent[0].sent_at);
    const minutesAgo = Math.round((now - lastSent) / (1000 * 60));
    console.log(`   Last message sent: ${minutesAgo} minutes ago`);
    if (minutesAgo > 60) {
      console.log(`   ⚠️ No messages sent in over an hour`);
    }
  } else {
    console.log(`   ⚠️ No sent messages found`);
  }

  // 9. Failed prospects
  console.log('\n9. FAILED PROSPECTS');
  const failedProspects = (prospects || []).filter(p => p.status === 'failed');
  console.log(`   Total failed: ${failedProspects.length}`);

  console.log('\n=== END ANALYSIS ===');
}

analyze().catch(console.error);
