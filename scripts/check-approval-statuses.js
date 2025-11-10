#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkApprovalStatuses() {
  // Get the most recent session
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) {
    console.log('❌ No sessions found');
    return;
  }

  const session = sessions[0];
  console.log('\n📋 Session:', session.campaign_name);
  console.log(`   Session ID: ${session.id}`);
  console.log(`   Total: ${session.total_prospects}`);
  console.log(`   Pending: ${session.pending_count}`);
  console.log(`   Approved: ${session.approved_count}`);
  console.log(`   Rejected: ${session.rejected_count}`);

  // Count by approval_status
  const { data: statusCounts } = await supabase
    .from('prospect_approval_data')
    .select('approval_status')
    .eq('session_id', session.id);

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0
  };

  statusCounts?.forEach(p => {
    if (p.approval_status in counts) {
      counts[p.approval_status]++;
    }
  });

  console.log('\n📊 Actual approval_status counts in database:');
  console.log(`   Pending: ${counts.pending}`);
  console.log(`   Approved: ${counts.approved}`);
  console.log(`   Rejected: ${counts.rejected}`);

  // Show sample approved prospects
  if (counts.approved > 0) {
    const { data: approved } = await supabase
      .from('prospect_approval_data')
      .select('name, title, company, approval_status')
      .eq('session_id', session.id)
      .eq('approval_status', 'approved')
      .limit(5);

    console.log('\n✅ Approved prospects:');
    approved?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ${p.title} at ${typeof p.company === 'object' ? p.company.name : p.company}`);
    });
  }
}

checkApprovalStatuses();
