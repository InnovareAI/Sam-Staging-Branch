import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Check queue status distribution
  const { data: queueStats } = await supabase
    .from('send_queue')
    .select('status, scheduled_for')
    .order('scheduled_for', { ascending: true });

  const statusCounts = {};
  const now = new Date();
  let overdueCount = 0;
  let oldestOverdue = null;

  for (const q of queueStats || []) {
    statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;

    if (q.status === 'pending') {
      const scheduled = new Date(q.scheduled_for);
      if (scheduled < now) {
        overdueCount++;
        if (!oldestOverdue || scheduled < oldestOverdue) {
          oldestOverdue = scheduled;
        }
      }
    }
  }

  console.log('Queue status distribution:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log('  ', status, ':', count);
  }

  console.log('\nOverdue pending items:', overdueCount);
  if (oldestOverdue) {
    const hoursAgo = (now - oldestOverdue) / (1000 * 60 * 60);
    console.log('Oldest overdue:', oldestOverdue.toISOString(), `(${hoursAgo.toFixed(1)} hours ago)`);
  }

  // Check next 5 pending items
  const { data: nextPending } = await supabase
    .from('send_queue')
    .select('id, campaign_id, scheduled_for, status, linkedin_user_id')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(5);

  console.log('\nNext 5 pending items:');
  for (const item of nextPending || []) {
    const scheduled = new Date(item.scheduled_for);
    const diff = (scheduled - now) / (1000 * 60);
    const status = diff < 0 ? `OVERDUE by ${Math.abs(diff).toFixed(0)}min` : `in ${diff.toFixed(0)}min`;
    console.log('  ', item.id.substring(0,8), '| scheduled:', item.scheduled_for, '|', status);
  }

  // Check when cron last ran successfully
  const { data: recentSent } = await supabase
    .from('send_queue')
    .select('id, sent_at, status')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(3);

  console.log('\nLast 3 sent items:');
  for (const item of recentSent || []) {
    console.log('  ', item.id.substring(0,8), '| sent_at:', item.sent_at);
  }
}

check().catch(console.error);
