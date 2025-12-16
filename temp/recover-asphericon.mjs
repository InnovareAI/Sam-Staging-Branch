#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = 'd7ced167-e7e7-42f2-ba12-dc3bb2d29cfc';

console.log('🔧 RECOVERING FAILED ASPHERICON PROSPECTS');
console.log('='.repeat(70));

// 1. Get all failed prospects
const { data: failedProspects, error: fetchError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, notes')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'failed');

if (fetchError) {
  console.error('Error fetching:', fetchError);
  process.exit(1);
}

console.log('Found', failedProspects?.length, 'failed prospects');

// 2. Check which ones have queue entries
const failedIds = failedProspects?.map(p => p.id) || [];

const { data: queueEntries } = await supabase
  .from('send_queue')
  .select('prospect_id, status')
  .in('prospect_id', failedIds);

const queueByProspect = {};
queueEntries?.forEach(q => {
  queueByProspect[q.prospect_id] = q.status;
});

console.log('Queue entries found:', Object.keys(queueByProspect).length);

// Count queue statuses
const queueStatusCount = {};
queueEntries?.forEach(q => {
  queueStatusCount[q.status] = (queueStatusCount[q.status] || 0) + 1;
});
console.log('Queue status breakdown:', queueStatusCount);

// 3. Recover prospects that have pending queue entries
const prospectsWithPendingQueue = failedProspects?.filter(p =>
  queueByProspect[p.id] === 'pending'
) || [];

console.log('\nProspects with pending queue entries:', prospectsWithPendingQueue.length);

if (prospectsWithPendingQueue.length > 0) {
  const idsToRecover = prospectsWithPendingQueue.map(p => p.id);

  const { data: updated, error: updateError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved',
      notes: 'Recovered from auto-failed status (had pending queue entry)',
      updated_at: new Date().toISOString()
    })
    .in('id', idsToRecover)
    .select('id');

  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('✅ Recovered', updated?.length, 'prospects with pending queue entries');
  }
}

// 4. For prospects without queue entries, recover and they'll need re-queuing
const prospectsWithoutQueue = failedProspects?.filter(p =>
  queueByProspect[p.id] === undefined
) || [];

console.log('\nProspects WITHOUT queue entries:', prospectsWithoutQueue.length);

if (prospectsWithoutQueue.length > 0) {
  const idsToRecover = prospectsWithoutQueue.map(p => p.id);

  const { data: updated, error: updateError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved',
      notes: 'Recovered from auto-failed status (needs re-queuing)',
      updated_at: new Date().toISOString()
    })
    .in('id', idsToRecover)
    .select('id');

  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('✅ Recovered', updated?.length, 'prospects (need re-queuing)');
  }
}

// 5. Also recover prospects with failed queue entries (stuck >1 hour)
const prospectsWithFailedQueue = failedProspects?.filter(p =>
  queueByProspect[p.id] === 'failed'
) || [];

console.log('\nProspects with FAILED queue entries:', prospectsWithFailedQueue.length);

if (prospectsWithFailedQueue.length > 0) {
  const idsToRecover = prospectsWithFailedQueue.map(p => p.id);

  // First recover the prospect status
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved',
      notes: 'Recovered from auto-failed status (queue was stuck)',
      updated_at: new Date().toISOString()
    })
    .in('id', idsToRecover);

  // Then reset queue entries to pending with staggered scheduling
  let scheduledTime = new Date();
  for (let i = 0; i < idsToRecover.length; i++) {
    // Schedule 20 minutes apart
    scheduledTime = new Date(scheduledTime.getTime() + 20 * 60 * 1000);

    await supabase
      .from('send_queue')
      .update({
        status: 'pending',
        error_message: null,
        scheduled_for: scheduledTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('prospect_id', idsToRecover[i])
      .eq('status', 'failed');
  }

  console.log('✅ Recovered', idsToRecover.length, 'failed queue entries with staggered scheduling');
}

// 6. Final status check
const { data: finalStatus } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('campaign_id', CAMPAIGN_ID);

const finalByStatus = {};
finalStatus?.forEach(p => {
  finalByStatus[p.status] = (finalByStatus[p.status] || 0) + 1;
});

console.log('\n📊 FINAL PROSPECT STATUS:');
Object.entries(finalByStatus).forEach(([status, count]) => {
  console.log('  ' + status.padEnd(25) + count);
});

// 7. Check queue status
const { data: queueFinal } = await supabase
  .from('send_queue')
  .select('status')
  .eq('campaign_id', CAMPAIGN_ID);

const queueFinalByStatus = {};
queueFinal?.forEach(q => {
  queueFinalByStatus[q.status] = (queueFinalByStatus[q.status] || 0) + 1;
});

console.log('\n📬 FINAL QUEUE STATUS:');
Object.entries(queueFinalByStatus).forEach(([status, count]) => {
  console.log('  ' + status.padEnd(15) + count);
});

console.log('\n✅ Recovery complete!');
