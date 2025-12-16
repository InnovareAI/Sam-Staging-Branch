#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

console.log('🔧 FIXING SAMANTHA TRUMAN WORKSPACE');
console.log('='.repeat(70));

// 1. Recover failed prospect
console.log('\n1️⃣ RECOVERING FAILED PROSPECT...');

const { data: failedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, campaign_id, notes')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'failed');

if (failedProspects && failedProspects.length > 0) {
  for (const p of failedProspects) {
    console.log('   Recovering:', p.first_name, p.last_name);
    console.log('   Previous notes:', p.notes);

    // Check if they have a queue entry
    const { data: queueEntry } = await supabase
      .from('send_queue')
      .select('*')
      .eq('prospect_id', p.id)
      .single();

    if (queueEntry) {
      // Has queue entry - recover to appropriate status
      const newStatus = queueEntry.status === 'sent' ? 'connection_request_sent' : 'approved';
      await supabase
        .from('campaign_prospects')
        .update({
          status: newStatus,
          notes: 'Recovered from auto-failed status',
          updated_at: new Date().toISOString()
        })
        .eq('id', p.id);
      console.log('   ✅ Recovered to:', newStatus);
    } else {
      // No queue entry - recover to approved and add to queue
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'approved',
          notes: 'Recovered from auto-failed status - needs queueing',
          updated_at: new Date().toISOString()
        })
        .eq('id', p.id);
      console.log('   ✅ Recovered to: approved (needs re-queueing)');
    }
  }
} else {
  console.log('   No failed prospects to recover');
}

// 2. Check connected prospects and their follow-up status
console.log('\n2️⃣ CHECKING FOLLOW-UP MESSAGES FOR CONNECTED PROSPECTS...');

const { data: connectedProspects } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns(name, message_templates)')
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['connected', 'accepted', 'messaging']);

console.log('   Found', connectedProspects?.length || 0, 'connected prospects');

for (const p of connectedProspects || []) {
  console.log('\n   👤', p.first_name, p.last_name);
  console.log('      Follow-up due:', p.follow_up_due_at);
  console.log('      Follow-up index:', p.follow_up_sequence_index);
  console.log('      Last follow-up:', p.last_follow_up_at);

  // Check if follow-up messages are in queue
  const { data: fuQueue } = await supabase
    .from('send_queue')
    .select('*')
    .eq('prospect_id', p.id)
    .neq('message_type', 'connection_request')
    .order('scheduled_for', { ascending: true });

  if (fuQueue && fuQueue.length > 0) {
    console.log('      📬 Follow-up queue items:', fuQueue.length);
    fuQueue.forEach(q => {
      console.log('         -', q.message_type, '|', q.status, '| Scheduled:', q.scheduled_for);
    });
  } else {
    console.log('      ⚠️  NO FOLLOW-UP MESSAGES IN QUEUE!');

    // Check campaign message templates
    const templates = p.campaigns?.message_templates;
    if (templates) {
      const parsed = typeof templates === 'string' ? JSON.parse(templates) : templates;
      console.log('      📝 Campaign has', (parsed?.length || 0), 'message templates');

      // Check if follow-ups should be created
      if (p.follow_up_due_at) {
        const dueDate = new Date(p.follow_up_due_at);
        const now = new Date();

        if (dueDate > now) {
          console.log('      ⏰ Follow-up due in future - should be in queue!');
          console.log('      🔧 This needs to be queued by the follow-up cron');
        } else {
          console.log('      ⏰ Follow-up was due in the past:', p.follow_up_due_at);
          console.log('      🔧 This follow-up may have been missed!');
        }
      }
    }
  }
}

// 3. Check what the follow-up processing cron does
console.log('\n3️⃣ CHECKING FOLLOW-UP PROCESSING STATUS...');

// The follow-up messages should be sent by the process-follow-ups cron
// Let's check if there are any pending follow-ups that should be processed

const { data: dueFollowUps } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, follow_up_due_at, follow_up_sequence_index, campaigns(name)')
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['connected', 'accepted', 'messaging'])
  .not('follow_up_due_at', 'is', null)
  .lte('follow_up_due_at', new Date().toISOString());

console.log('   Prospects with OVERDUE follow-ups:', dueFollowUps?.length || 0);

for (const p of dueFollowUps || []) {
  console.log('   ⚠️', p.first_name, p.last_name);
  console.log('      Due:', p.follow_up_due_at);
  console.log('      Index:', p.follow_up_sequence_index);
  console.log('      Campaign:', p.campaigns?.name);
}

// 4. Summary and recommendations
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY & RECOMMENDATIONS');

if (dueFollowUps && dueFollowUps.length > 0) {
  console.log('\n⚠️  ISSUE: ' + dueFollowUps.length + ' prospects have overdue follow-ups');
  console.log('   These follow-ups should have been sent but weren\'t.');
  console.log('   RECOMMENDATION: Run the process-follow-ups cron manually OR');
  console.log('   manually queue follow-up messages for these prospects.');
}

// Check if the follow-up processing cron is configured
console.log('\n📋 FOLLOW-UP SYSTEM CHECK:');
console.log('   The system should have a cron: /api/cron/process-follow-ups');
console.log('   OR /api/campaigns/direct/process-follow-ups');
console.log('   This cron checks for prospects with due follow-ups and sends messages.');

console.log('\n✅ Recovery complete!');
