#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '5b81ee67-4d41-4997-b5a4-e1432e060d12';

console.log('🔍 STAN BOUNEV WORKSPACE CHECK');
console.log('='.repeat(70));

// 1. Get workspace details
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', WORKSPACE_ID)
  .single();

console.log('\n1️⃣ WORKSPACE INFO:');
console.log('   Name:', workspace?.name);
console.log('   ID:', workspace?.id);
console.log('   Created:', workspace?.created_at);

// 2. Get LinkedIn accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID);

console.log('\n2️⃣ LINKEDIN ACCOUNTS:');
if (accounts && accounts.length > 0) {
  for (const acc of accounts) {
    console.log(`   - ${acc.account_name}`);
    console.log(`     Type: ${acc.account_type}`);
    console.log(`     Unipile ID: ${acc.unipile_account_id}`);
    console.log(`     Status: ${acc.connection_status}`);
  }
} else {
  console.log('   ⚠️  No LinkedIn accounts connected');
}

// 3. Get campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log('\n3️⃣ CAMPAIGNS:');
if (campaigns && campaigns.length > 0) {
  for (const c of campaigns) {
    // Get prospect counts for this campaign
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', c.id);

    const byStatus = {};
    prospects?.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    console.log(`\n   📋 ${c.name}`);
    console.log(`      ID: ${c.id}`);
    console.log(`      Status: ${c.status}`);
    console.log(`      Created: ${c.created_at}`);
    console.log(`      Prospects: ${prospects?.length || 0}`);
    if (Object.keys(byStatus).length > 0) {
      console.log(`      Breakdown: ${JSON.stringify(byStatus)}`);
    }

    // Get queue items for this campaign
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('status')
      .eq('campaign_id', c.id);

    if (queueItems && queueItems.length > 0) {
      const qByStatus = {};
      queueItems.forEach(q => {
        qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
      });
      console.log(`      Queue: ${JSON.stringify(qByStatus)}`);
    }
  }
} else {
  console.log('   No campaigns found');
}

// 4. Check for any failed prospects
const { data: failedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, notes, status, campaign_id')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'failed');

console.log('\n4️⃣ FAILED PROSPECTS:');
if (failedProspects && failedProspects.length > 0) {
  console.log(`   Found ${failedProspects.length} failed prospects:`);
  for (const p of failedProspects.slice(0, 10)) {
    console.log(`   - ${p.first_name} ${p.last_name}`);
    console.log(`     Notes: ${p.notes}`);
  }
  if (failedProspects.length > 10) {
    console.log(`   ... and ${failedProspects.length - 10} more`);
  }
} else {
  console.log('   ✅ No failed prospects');
}

// 5. Check connected prospects and follow-ups
const { data: connectedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, follow_up_due_at, follow_up_sequence_index, status')
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['connected', 'messaging']);

console.log('\n5️⃣ CONNECTED PROSPECTS (pending follow-ups):');
if (connectedProspects && connectedProspects.length > 0) {
  for (const p of connectedProspects) {
    console.log(`   - ${p.first_name} ${p.last_name}`);
    console.log(`     Status: ${p.status}`);
    console.log(`     Follow-up due: ${p.follow_up_due_at || 'Not scheduled'}`);
    console.log(`     Follow-up index: ${p.follow_up_sequence_index || 0}`);
  }
} else {
  console.log('   No connected prospects awaiting follow-ups');
}

// 6. Check replied prospects
const { data: repliedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, responded_at, status')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'replied');

console.log('\n6️⃣ REPLIED PROSPECTS:');
if (repliedProspects && repliedProspects.length > 0) {
  for (const p of repliedProspects) {
    console.log(`   - ${p.first_name} ${p.last_name}`);
    console.log(`     Responded: ${p.responded_at}`);
  }
} else {
  console.log('   No replied prospects yet');
}

// 7. Check send queue status
const { data: queueStats } = await supabase
  .from('send_queue')
  .select('status, scheduled_for, message_type')
  .eq('workspace_id', WORKSPACE_ID);

console.log('\n7️⃣ SEND QUEUE:');
if (queueStats && queueStats.length > 0) {
  const byStatus = {};
  queueStats.forEach(q => {
    byStatus[q.status] = (byStatus[q.status] || 0) + 1;
  });
  console.log(`   Total: ${queueStats.length}`);
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });

  // Show next pending
  const pending = queueStats.filter(q => q.status === 'pending').sort((a, b) =>
    new Date(a.scheduled_for) - new Date(b.scheduled_for)
  );
  if (pending.length > 0) {
    console.log(`   Next scheduled: ${pending[0].scheduled_for}`);
  }
} else {
  console.log('   Queue is empty');
}

console.log('\n' + '='.repeat(70));
console.log('✅ Check complete');
