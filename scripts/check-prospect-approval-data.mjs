#!/usr/bin/env node

/**
 * Check prospect_approval_data records
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking prospect_approval_data table\n');

// Get recent sessions
const { data: sessions, error: sessionsError } = await supabase
  .from('prospect_approval_sessions')
  .select('id, created_at, approved_count, rejected_count, pending_count')
  .order('created_at', { ascending: false })
  .limit(5);

if (sessionsError) {
  console.error('❌ Error fetching sessions:', sessionsError);
  process.exit(1);
}

console.log(`Found ${sessions.length} recent sessions:\n`);

for (const session of sessions) {
  console.log(`Session: ${session.id}`);
  console.log(`  Created: ${session.created_at}`);
  console.log(`  Counts: ${session.approved_count} approved, ${session.rejected_count} rejected, ${session.pending_count} pending`);

  // Get approval data for this session
  const { data: approvalData, error: dataError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  if (dataError) {
    console.error('  ❌ Error fetching approval data:', dataError);
  } else {
    console.log(`  📊 Found ${approvalData.length} records in prospect_approval_data`);

    if (approvalData.length > 0) {
      console.log(`  Sample record:`, {
        prospect_id: approvalData[0].prospect_id,
        approval_status: approvalData[0].approval_status,
        created_at: approvalData[0].created_at
      });
    }
  }

  // Get decisions for this session
  const { data: decisions, error: decisionsError } = await supabase
    .from('prospect_approval_decisions')
    .select('*')
    .eq('session_id', session.id);

  if (decisionsError) {
    console.error('  ❌ Error fetching decisions:', decisionsError);
  } else {
    console.log(`  📋 Found ${decisions.length} records in prospect_approval_decisions`);

    if (decisions.length > 0) {
      console.log(`  Sample decision:`, {
        prospect_id: decisions[0].prospect_id,
        decision: decisions[0].decision,
        decided_at: decisions[0].decided_at
      });
    }
  }

  console.log('');
}

// Check for orphaned decisions (decisions without approval data)
console.log('\n🔍 Checking for orphaned decisions...\n');

const { data: allDecisions } = await supabase
  .from('prospect_approval_decisions')
  .select('session_id, prospect_id, decision');

const { data: allApprovalData } = await supabase
  .from('prospect_approval_data')
  .select('session_id, prospect_id, approval_status');

const approvalDataMap = new Map(
  allApprovalData.map(d => [`${d.session_id}:${d.prospect_id}`, d])
);

let orphanedCount = 0;
for (const decision of allDecisions) {
  const key = `${decision.session_id}:${decision.prospect_id}`;
  if (!approvalDataMap.has(key)) {
    orphanedCount++;
    console.log(`❌ Orphaned decision: session=${decision.session_id}, prospect=${decision.prospect_id}, decision=${decision.decision}`);
  }
}

if (orphanedCount === 0) {
  console.log('✅ No orphaned decisions found');
} else {
  console.log(`\n⚠️  Found ${orphanedCount} orphaned decisions`);
}

console.log('\n✅ Check complete');
