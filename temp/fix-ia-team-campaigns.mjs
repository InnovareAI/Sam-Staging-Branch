#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo', 'Jennifer Fleming'];

console.log('🔧 FIXING IA TEAM CAMPAIGNS');
console.log('='.repeat(70));

// 1. First, let's understand the failure reasons
console.log('\n1️⃣ ANALYZING FAILURE REASONS...\n');

for (const name of targetNames) {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  // Get failed prospects with notes
  const { data: failed } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, notes, status, campaign_id')
    .eq('workspace_id', workspace.id)
    .eq('status', 'failed')
    .limit(10);

  // Get failed queue items with error messages
  const { data: failedQueue } = await supabase
    .from('send_queue')
    .select('id, error_message, prospect_id, campaign_id')
    .eq('workspace_id', workspace.id)
    .eq('status', 'failed')
    .limit(10);

  console.log(`👤 ${name}:`);

  if (failed && failed.length > 0) {
    const reasons = {};
    failed.forEach(f => {
      const reason = f.notes || 'Unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    console.log('   Failed prospect reasons:');
    Object.entries(reasons).forEach(([reason, count]) => {
      console.log(`      - ${reason}: ${count}`);
    });
  }

  if (failedQueue && failedQueue.length > 0) {
    const qReasons = {};
    failedQueue.forEach(q => {
      const reason = q.error_message || 'Unknown';
      qReasons[reason] = (qReasons[reason] || 0) + 1;
    });
    console.log('   Failed queue reasons:');
    Object.entries(qReasons).forEach(([reason, count]) => {
      console.log(`      - ${reason.slice(0, 60)}...: ${count}`);
    });
  }
  console.log();
}

// 2. Now fix the issues
console.log('\n2️⃣ FIXING ISSUES...\n');

let totalProspectsRecovered = 0;
let totalQueueRecovered = 0;

for (const name of targetNames) {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  console.log(`\n👤 ${name} (${workspace.id.slice(0, 8)}...):`);

  // A. Recover failed prospects that have pending queue entries
  const { data: failedProspects } = await supabase
    .from('campaign_prospects')
    .select('id, notes')
    .eq('workspace_id', workspace.id)
    .eq('status', 'failed');

  if (failedProspects && failedProspects.length > 0) {
    const failedIds = failedProspects.map(p => p.id);

    // Check which have pending queue entries
    const { data: pendingQueue } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .in('prospect_id', failedIds)
      .eq('status', 'pending');

    const pendingProspectIds = pendingQueue?.map(q => q.prospect_id) || [];

    if (pendingProspectIds.length > 0) {
      // Recover these prospects to 'approved'
      const { data: recovered } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'approved',
          notes: 'Recovered - had pending queue entry',
          updated_at: new Date().toISOString()
        })
        .in('id', pendingProspectIds)
        .select('id');

      console.log(`   ✅ Recovered ${recovered?.length || 0} prospects with pending queue`);
      totalProspectsRecovered += recovered?.length || 0;
    }

    // B. For prospects with failed queue entries, recover and reschedule
    const { data: failedQueueEntries } = await supabase
      .from('send_queue')
      .select('id, prospect_id, campaign_id, scheduled_for')
      .in('prospect_id', failedIds)
      .eq('status', 'failed');

    if (failedQueueEntries && failedQueueEntries.length > 0) {
      const failedQueueProspectIds = [...new Set(failedQueueEntries.map(q => q.prospect_id))];

      // Reset queue entries to pending with staggered scheduling
      let scheduledTime = new Date();
      for (let i = 0; i < failedQueueEntries.length; i++) {
        scheduledTime = new Date(scheduledTime.getTime() + 25 * 60 * 1000); // 25 min apart

        await supabase
          .from('send_queue')
          .update({
            status: 'pending',
            error_message: null,
            scheduled_for: scheduledTime.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', failedQueueEntries[i].id);
      }

      // Recover the prospects
      const { data: recoveredFromFailed } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'approved',
          notes: 'Recovered - queue rescheduled',
          updated_at: new Date().toISOString()
        })
        .in('id', failedQueueProspectIds)
        .select('id');

      console.log(`   ✅ Recovered ${recoveredFromFailed?.length || 0} prospects, rescheduled ${failedQueueEntries.length} queue items`);
      totalProspectsRecovered += recoveredFromFailed?.length || 0;
      totalQueueRecovered += failedQueueEntries.length;
    }

    // C. For failed prospects WITHOUT any queue entry, add them to the queue
    const allQueuedProspects = await supabase
      .from('send_queue')
      .select('prospect_id')
      .in('prospect_id', failedIds);

    const queuedProspectIds = new Set(allQueuedProspects.data?.map(q => q.prospect_id) || []);
    const prospectsWithoutQueue = failedProspects.filter(p => !queuedProspectIds.has(p.id));

    if (prospectsWithoutQueue.length > 0) {
      console.log(`   ⚠️  ${prospectsWithoutQueue.length} failed prospects have NO queue entry - need manual re-queueing`);

      // Just recover them to approved - they'll need to be manually added to campaigns again
      const noQueueIds = prospectsWithoutQueue.map(p => p.id);
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'approved',
          notes: 'Recovered - needs re-queueing',
          updated_at: new Date().toISOString()
        })
        .in('id', noQueueIds);

      console.log(`   ✅ Recovered ${noQueueIds.length} prospects to approved (need re-queueing)`);
      totalProspectsRecovered += noQueueIds.length;
    }
  } else {
    console.log('   No failed prospects');
  }
}

// 3. Final status
console.log('\n' + '='.repeat(70));
console.log('📊 RECOVERY SUMMARY:');
console.log(`   Total prospects recovered: ${totalProspectsRecovered}`);
console.log(`   Total queue items rescheduled: ${totalQueueRecovered}`);

// 4. Show updated status
console.log('\n3️⃣ UPDATED STATUS:\n');

for (const name of targetNames) {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('workspace_id', workspace.id);

  const byStatus = {};
  prospects?.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  const { data: queue } = await supabase
    .from('send_queue')
    .select('status')
    .eq('workspace_id', workspace.id);

  const qByStatus = {};
  queue?.forEach(q => {
    qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
  });

  console.log(`👤 ${name}:`);
  console.log(`   Prospects: ${JSON.stringify(byStatus)}`);
  console.log(`   Queue: ${JSON.stringify(qByStatus)}`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ Fix complete!');
