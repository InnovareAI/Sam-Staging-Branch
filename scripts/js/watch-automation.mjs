#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('👀 Watching for automatic prospect processing...\n');
console.log('Press Ctrl+C to stop\n');

let lastCount = null;

async function checkStatus() {
  const { data: pending } = await supabase
    .from('campaign_prospects')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'approved', 'ready_to_message']);

  const { data: sent } = await supabase
    .from('campaign_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'connection_requested');

  const now = new Date().toLocaleTimeString();
  const pendingCount = pending.count || 0;
  const sentCount = sent.count || 0;

  if (lastCount === null) {
    console.log(`[${now}] Starting: ${pendingCount} pending, ${sentCount} sent`);
  } else if (lastCount !== pendingCount) {
    const processed = lastCount - pendingCount;
    console.log(`[${now}] ✅ ${processed} prospects processed! (${pendingCount} pending, ${sentCount} sent)`);
  } else {
    console.log(`[${now}] Waiting... (${pendingCount} pending, ${sentCount} sent)`);
  }

  lastCount = pendingCount;
}

// Check every 30 seconds
setInterval(checkStatus, 30000);
checkStatus();
