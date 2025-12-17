import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkDrafts() {
  const now = new Date();
  
  // Get pending reply drafts that are not expired
  const { data: drafts } = await supabase
    .from('reply_agent_drafts')
    .select('id, prospect_id, prospect_name, channel, status, inbound_message_id, created_at')
    .in('status', ['pending_approval', 'pending_generation'])
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false });

  console.log('=== CHECKING REPLY DRAFTS FOR DUPLICATE SENDS ===');
  console.log('Found', drafts ? drafts.length : 0, 'non-expired pending drafts\n');

  if (!drafts || drafts.length === 0) return;

  for (const draft of drafts) {
    console.log('📝 Draft for:', draft.prospect_name);
    console.log('   Channel:', draft.channel);
    console.log('   Prospect ID:', draft.prospect_id);
    
    // Check if there is already a sent reply for this prospect
    const { data: sentReplies } = await supabase
      .from('reply_agent_drafts')
      .select('id, status, sent_at')
      .eq('prospect_id', draft.prospect_id)
      .eq('status', 'sent')
      .gte('created_at', draft.created_at);
    
    if (sentReplies && sentReplies.length > 0) {
      console.log('   ⚠️  WARNING: Already has sent reply!', sentReplies[0].sent_at);
    } else {
      console.log('   ✅ No duplicate - safe to approve');
    }
    
    // Also check send_queue for any recent outbound to this prospect
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('id, status, message_type, sent_at, created_at')
      .eq('prospect_id', draft.prospect_id)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (queueItems && queueItems.length > 0) {
      console.log('   Recent queue items:');
      queueItems.forEach(q => {
        console.log('     -', q.message_type, '|', q.status, '| Created:', q.created_at ? q.created_at.substring(0,10) : 'N/A');
      });
    }
    console.log('');
  }
}

checkDrafts().catch(console.error);
