#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

console.log('🔍 SAMANTHA TRUMAN FULL WORKSPACE CHECK');
console.log('='.repeat(70));

// 1. Get all campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log('\n📋 ALL CAMPAIGNS:', campaigns?.length || 0);

for (const c of campaigns || []) {
  console.log('\n' + '─'.repeat(70));
  console.log('📊 CAMPAIGN:', c.name);
  console.log('   ID:', c.id);
  console.log('   Status:', c.status);
  console.log('   LinkedIn Account:', c.linkedin_account_id);
  console.log('   Created:', c.created_at);

  // Get all prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', c.id);

  const byStatus = {};
  prospects?.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  console.log('\n   👥 PROSPECTS:', prospects?.length || 0);
  console.log('   Status breakdown:', JSON.stringify(byStatus));

  // Check for connected prospects (accepted CRs)
  const connected = prospects?.filter(p =>
    ['connected', 'accepted', 'messaging', 'replied'].includes(p.status)
  ) || [];

  if (connected.length > 0) {
    console.log('\n   🎉 CONNECTED PROSPECTS:', connected.length);
    for (const p of connected) {
      console.log('      - ' + p.first_name + ' ' + p.last_name);
      console.log('        Status:', p.status);
      console.log('        Connection accepted:', p.connection_accepted_at || 'NOT SET');
      console.log('        Follow-up due:', p.follow_up_due_at || 'NOT SET');
      console.log('        Follow-up index:', p.follow_up_sequence_index);
      console.log('        Last follow-up:', p.last_follow_up_at || 'NONE');
    }
  }

  // Check for failed prospects
  const failed = prospects?.filter(p => p.status === 'failed') || [];
  if (failed.length > 0) {
    console.log('\n   ❌ FAILED PROSPECTS:', failed.length);
    for (const p of failed) {
      console.log('      - ' + p.first_name + ' ' + p.last_name);
      console.log('        Notes:', p.notes || 'none');
    }
  }

  // Check queue for this campaign
  const { data: queueItems } = await supabase
    .from('send_queue')
    .select('*')
    .eq('campaign_id', c.id)
    .order('scheduled_for', { ascending: true });

  if (queueItems && queueItems.length > 0) {
    const qByStatus = {};
    queueItems.forEach(q => {
      qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
    });
    console.log('\n   📬 QUEUE:', JSON.stringify(qByStatus));

    // Check for pending follow-up messages
    const pendingFollowUps = queueItems.filter(q =>
      q.status === 'pending' && q.message_type && q.message_type !== 'connection_request'
    );

    if (pendingFollowUps.length > 0) {
      console.log('   📨 PENDING FOLLOW-UPS:', pendingFollowUps.length);
      pendingFollowUps.forEach(fu => {
        console.log('      - Type:', fu.message_type, '| Scheduled:', fu.scheduled_for);
      });
    }

    // Check for any queue items for connected prospects
    const connectedIds = connected.map(p => p.id);
    const queueForConnected = queueItems.filter(q => connectedIds.includes(q.prospect_id));
    if (queueForConnected.length > 0) {
      console.log('\n   📬 QUEUE ITEMS FOR CONNECTED PROSPECTS:');
      queueForConnected.forEach(q => {
        const prospect = connected.find(p => p.id === q.prospect_id);
        console.log('      - ' + (prospect?.first_name || 'Unknown'));
        console.log('        Type:', q.message_type || 'CR');
        console.log('        Status:', q.status);
        console.log('        Scheduled:', q.scheduled_for);
        console.log('        Error:', q.error_message || 'none');
      });
    }
  }

  // Check campaign message templates
  if (c.message_templates) {
    console.log('\n   📝 MESSAGE TEMPLATES:');
    const templates = typeof c.message_templates === 'string'
      ? JSON.parse(c.message_templates)
      : c.message_templates;

    if (Array.isArray(templates)) {
      templates.forEach((t, i) => {
        console.log('      ' + (i + 1) + '. ' + (t.name || t.type || 'Step ' + (i + 1)));
        console.log('         Delay:', t.delay_days || 0, 'days');
      });
    }
  }
}

// 2. Check if there are follow-up messages scheduled for connected prospects
console.log('\n' + '='.repeat(70));
console.log('🔄 FOLLOW-UP MESSAGE CHECK');

const { data: allConnected } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns(name, message_templates)')
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['connected', 'accepted', 'messaging']);

console.log('\nTotal connected prospects across all campaigns:', allConnected?.length || 0);

if (allConnected && allConnected.length > 0) {
  for (const p of allConnected) {
    console.log('\n👤 ' + p.first_name + ' ' + p.last_name);
    console.log('   Campaign:', p.campaigns?.name);
    console.log('   Status:', p.status);
    console.log('   Connection accepted:', p.connection_accepted_at || 'NOT RECORDED');
    console.log('   Follow-up due:', p.follow_up_due_at || 'NOT SCHEDULED');
    console.log('   Follow-up index:', p.follow_up_sequence_index);

    // Check if there are pending queue items for this prospect
    const { data: prospectQueue } = await supabase
      .from('send_queue')
      .select('*')
      .eq('prospect_id', p.id)
      .order('scheduled_for', { ascending: true });

    if (prospectQueue && prospectQueue.length > 0) {
      console.log('   📬 Queue items:', prospectQueue.length);
      prospectQueue.forEach(q => {
        console.log('      - ' + (q.message_type || 'CR') + ' | ' + q.status + ' | ' + q.scheduled_for);
      });
    } else {
      console.log('   ⚠️  NO QUEUE ITEMS - Follow-ups may not be scheduled!');
    }
  }
}

// 3. Summary
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY');

const { count: totalProspects } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

const { count: failedCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'failed');

const { count: connectedCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['connected', 'accepted', 'messaging']);

const { count: crSentCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID)
  .eq('status', 'connection_request_sent');

console.log('  Total prospects:', totalProspects);
console.log('  CR Sent:', crSentCount);
console.log('  Connected:', connectedCount);
console.log('  Failed:', failedCount);

if (failedCount > 0) {
  console.log('\n⚠️  ACTION NEEDED: ' + failedCount + ' failed prospect(s) may need recovery');
}

if (connectedCount > 0 && allConnected?.some(p => !p.follow_up_due_at)) {
  console.log('⚠️  ACTION NEEDED: Some connected prospects have no follow-up scheduled');
}
