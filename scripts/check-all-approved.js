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

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkAllApproved() {
  // Get all sessions for this workspace
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  console.log(`\n📋 Found ${sessions?.length || 0} sessions in workspace\n`);

  let totalApproved = 0;

  for (const session of sessions || []) {
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

    totalApproved += counts.approved;

    console.log(`Session: ${session.campaign_name}`);
    console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`  Batch #: ${session.batch_number}`);
    console.log(`  Total: ${session.total_prospects}`);
    console.log(`  Approved: ${counts.approved}`);
    console.log(`  Pending: ${counts.pending}`);
    console.log(`  Rejected: ${counts.rejected}`);
    console.log('');
  }

  console.log(`\n📊 TOTAL APPROVED ACROSS ALL SESSIONS: ${totalApproved}`);
}

checkAllApproved();
