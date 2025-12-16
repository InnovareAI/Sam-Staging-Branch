#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 SAMANTHA TRUMAN WORKSPACE CHECK');
console.log('='.repeat(70));

// Find Samantha's workspace account
const { data: samAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .ilike('account_name', '%samantha%');

console.log('\n🔗 LINKEDIN ACCOUNT:');
if (samAccount && samAccount.length > 0) {
  const acc = samAccount[0];
  console.log('  Name:', acc.account_name);
  console.log('  ID:', acc.id);
  console.log('  Unipile ID:', acc.unipile_account_id);
  console.log('  Workspace ID:', acc.workspace_id);
  console.log('  Status:', acc.connection_status);

  // Get workspace details
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', acc.workspace_id)
    .single();

  console.log('\n📁 WORKSPACE:');
  console.log('  Name:', workspace?.name);
  console.log('  ID:', workspace?.id);

  // Get campaigns for this workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', acc.workspace_id)
    .order('created_at', { ascending: false });

  console.log('\n📋 CAMPAIGNS:');
  if (campaigns && campaigns.length > 0) {
    for (const c of campaigns) {
      const { data: prospects, count } = await supabase
        .from('campaign_prospects')
        .select('status', { count: 'exact' })
        .eq('campaign_id', c.id);

      const byStatus = {};
      prospects?.forEach(p => {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      });

      console.log('  📊 ' + c.name);
      console.log('     Status:', c.status, '| Prospects:', count || 0);
      if (Object.keys(byStatus).length > 0) {
        console.log('     Breakdown:', JSON.stringify(byStatus));
      }

      // Check queue for this campaign
      const { data: queueItems } = await supabase
        .from('send_queue')
        .select('status')
        .eq('campaign_id', c.id);

      if (queueItems && queueItems.length > 0) {
        const qByStatus = {};
        queueItems.forEach(q => {
          qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
        });
        console.log('     Queue:', JSON.stringify(qByStatus));
      }
      console.log();
    }
  } else {
    console.log('  No campaigns found');
  }

  // Check for failed prospects that need recovery
  const { data: failedProspects, count: failedCount } = await supabase
    .from('campaign_prospects')
    .select('id, notes', { count: 'exact' })
    .eq('workspace_id', acc.workspace_id)
    .eq('status', 'failed');

  if (failedCount > 0) {
    console.log('\n⚠️  FAILED PROSPECTS:', failedCount);
    const notesCount = {};
    failedProspects?.forEach(p => {
      const note = p.notes || 'NO NOTES';
      notesCount[note] = (notesCount[note] || 0) + 1;
    });
    Object.entries(notesCount).forEach(([note, cnt]) => {
      console.log('  ' + cnt + 'x: ' + note.substring(0, 60));
    });
  }

} else {
  console.log('  No account found for Samantha Truman');

  // Search in workspace_accounts by workspace name
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .ilike('name', '%truman%');

  if (workspaces && workspaces.length > 0) {
    console.log('\n  Found workspaces:', workspaces);
  }
}
