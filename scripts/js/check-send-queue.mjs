#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSendQueue() {
  const campaignId = '1d3428f8-454d-4ffb-8337-4273f781adfb';
  
  console.log('\n📅 SEND QUEUE VERIFICATION (Message Timestamps)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check send_queue table for scheduled messages
  const { data: queue, error } = await supabase
    .from('send_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!queue || queue.length === 0) {
    console.log('⚠️  No messages in send queue for this campaign\n');
    console.log('This means timestamps are NOT being scheduled.\n');
    return;
  }

  console.log(`✅ Found ${queue.length} messages in send queue\n`);
  console.log('Scheduled Messages:\n');

  queue.forEach((msg, i) => {
    const scheduledTime = new Date(msg.scheduled_for);
    const now = new Date();
    const isPast = scheduledTime < now;
    
    console.log(`${i + 1}. ${msg.linkedin_user_id || 'Unknown prospect'}`);
    console.log(`   ├─ Status: ${msg.status}`);
    console.log(`   ├─ Scheduled: ${scheduledTime.toLocaleString()} ${isPast ? '⏰ (past due)' : '⏳ (upcoming)'}`);
    console.log(`   ├─ Sent: ${msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'Not yet'}`);
    console.log(`   └─ Error: ${msg.error_message || 'None'}\n`);
  });

  // Summary
  const pending = queue.filter(m => m.status === 'pending').length;
  const sent = queue.filter(m => m.status === 'sent').length;
  const failed = queue.filter(m => m.status === 'failed').length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Summary:');
  console.log(`   - Pending: ${pending}`);
  console.log(`   - Sent: ${sent}`);
  console.log(`   - Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkSendQueue();
