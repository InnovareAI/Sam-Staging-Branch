#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '5b81ee67-4d41-4997-b5a4-e1432e060d12';

console.log('📬 STAN BOUNEV - DID PROSPECTS RESPOND TO SAM?');
console.log('='.repeat(70));

// Get ALL prospects to see their statuses
const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, connection_accepted_at, contacted_at, responded_at')
  .eq('workspace_id', WORKSPACE_ID)
  .order('status', { ascending: true });

console.log(`\nTotal prospects: ${allProspects?.length || 0}\n`);

// Group by status
const byStatus = {};
allProspects?.forEach(p => {
  byStatus[p.status] = byStatus[p.status] || [];
  byStatus[p.status].push(p);
});

console.log('STATUS BREAKDOWN:');
Object.entries(byStatus).forEach(([status, prospects]) => {
  console.log(`\n${status.toUpperCase()} (${prospects.length}):`);

  if (status === 'connection_request_sent') {
    // Check if any have been accepted (connection_accepted_at set)
    const accepted = prospects.filter(p => p.connection_accepted_at);
    console.log(`   - Accepted connection: ${accepted.length}`);
    console.log(`   - Still pending: ${prospects.length - accepted.length}`);
  } else if (status === 'replied') {
    for (const p of prospects) {
      console.log(`   ✅ ${p.first_name} ${p.last_name} - responded ${p.responded_at}`);
    }
  } else if (status === 'connected') {
    for (const p of prospects) {
      console.log(`   🤝 ${p.first_name} ${p.last_name} - accepted ${p.connection_accepted_at}`);
    }
  } else {
    for (const p of prospects.slice(0, 5)) {
      console.log(`   - ${p.first_name} ${p.last_name}`);
    }
    if (prospects.length > 5) {
      console.log(`   ... and ${prospects.length - 5} more`);
    }
  }
});

// Check if any CR_sent have actually accepted (webhook may not have fired)
console.log('\n' + '─'.repeat(70));
console.log('CHECKING CONNECTION_REQUEST_SENT PROSPECTS FOR ACCEPTANCES...');

const crSent = byStatus['connection_request_sent'] || [];
const accepted = crSent.filter(p => p.connection_accepted_at);

if (accepted.length > 0) {
  console.log(`\n⚠️  Found ${accepted.length} prospects marked as CR_sent but have connection_accepted_at:`);
  for (const p of accepted) {
    console.log(`   - ${p.first_name} ${p.last_name} (accepted: ${p.connection_accepted_at})`);
  }
  console.log('\n   These should be updated to "connected" status!');
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('SUMMARY:');
console.log(`   Total prospects: ${allProspects?.length || 0}`);
console.log(`   Connection requests sent: ${(byStatus['connection_request_sent'] || []).length}`);
console.log(`   Connected (accepted): ${(byStatus['connected'] || []).length}`);
console.log(`   Replied: ${(byStatus['replied'] || []).length}`);
console.log(`   Failed: ${(byStatus['failed'] || []).length}`);
