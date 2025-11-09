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

async function findSession() {
  console.log('\n🔍 Looking for approval sessions with prospects...\n');

  // Get recent approval sessions with their prospect counts
  const { data: sessions, error } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${sessions.length} recent sessions:\n`);

  for (const session of sessions) {
    // Count prospects for this session
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    // Count approved prospects
    const { count: approvedCount } = await supabase
      .from('prospect_approval_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('decision', 'approved');

    console.log(`Session: ${session.id.substring(0, 8)}...`);
    console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`  Workspace: ${session.workspace_id}`);
    console.log(`  Prospects: ${count} total, ${approvedCount || 0} approved`);
    console.log(`  Status: ${session.status}`);

    // Show all columns to see what's available
    console.log(`  All data:`, JSON.stringify(session, null, 2));
    console.log('');
  }
}

findSession();
