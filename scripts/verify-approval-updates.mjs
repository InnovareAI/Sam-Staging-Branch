#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Verifying approval status updates\n');

// Get most recent session
const { data: sessions } = await supabase
  .from('prospect_approval_sessions')
  .select('id, created_at')
  .order('created_at', { ascending: false })
  .limit(1);

if (!sessions || sessions.length === 0) {
  console.log('No sessions found');
  process.exit(0);
}

const sessionId = sessions[0].id;
console.log(`Session: ${sessionId}`);
console.log(`Created: ${sessions[0].created_at}\n`);

// Get prospects from this session
const { data: prospects } = await supabase
  .from('prospect_approval_data')
  .select('session_id, prospect_id, name, approval_status')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: false })
  .limit(3);

console.log('Current prospects:');
prospects.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.name}: ${p.approval_status}`);
});

if (prospects.length > 0) {
  const p = prospects[0];
  const newStatus = p.approval_status === 'approved' ? 'pending' : 'approved';

  console.log(`\n🔄 Testing update: ${p.name} → ${newStatus}`);

  const { data, error } = await supabase
    .from('prospect_approval_data')
    .update({ approval_status: newStatus })
    .eq('session_id', p.session_id)
    .eq('prospect_id', p.prospect_id)
    .select();

  if (error) {
    console.error('❌ Update failed:', error);
  } else {
    console.log('✅ Update successful!');
    console.log(`   New status: ${data[0]?.approval_status}`);
  }

  // Check decision table
  const { data: decision } = await supabase
    .from('prospect_approval_decisions')
    .select('decision, decided_at')
    .eq('session_id', p.session_id)
    .eq('prospect_id', p.prospect_id)
    .single();

  if (decision) {
    console.log(`   Decision table: ${decision.decision} (at ${decision.decided_at})`);
  } else {
    console.log('   No decision record found');
  }
}
