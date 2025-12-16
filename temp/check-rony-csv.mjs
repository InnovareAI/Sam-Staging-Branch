#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RONY_WORKSPACE_ID = '8a720935-db68-43e2-b16d-34383ec6c3e8';

console.log('🔍 CHECKING RONY CSV UPLOADS');
console.log('='.repeat(70));

// Check csv_uploads table
const { data: uploads, error } = await supabase
  .from('csv_uploads')
  .select('*')
  .eq('workspace_id', RONY_WORKSPACE_ID)
  .order('created_at', { ascending: false });

if (error) {
  console.log(`Error: ${error.message}`);
} else {
  console.log(`\nCSV Uploads: ${uploads?.length || 0}`);
  for (const u of uploads || []) {
    console.log(`\n- File: ${u.filename}`);
    console.log(`  Status: ${u.status}`);
    console.log(`  Total Rows: ${u.total_rows}`);
    console.log(`  Valid Rows: ${u.valid_rows}`);
    console.log(`  Error: ${u.error_message || 'none'}`);
    console.log(`  Created: ${u.created_at}`);
  }
}

// Check recent system activity
const { data: activity } = await supabase
  .from('system_activity_log')
  .select('*')
  .eq('workspace_id', RONY_WORKSPACE_ID)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\nRecent Activity: ${activity?.length || 0}`);
for (const a of activity || []) {
  console.log(`  - ${a.action_type}: ${JSON.stringify(a.details).slice(0, 100)}`);
}

// Check if there's a LinkedIn account linked
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', RONY_WORKSPACE_ID);

console.log(`\nLinked Accounts: ${accounts?.length || 0}`);

if (!accounts?.length) {
  console.log('\n⚠️ NO LINKEDIN ACCOUNT LINKED - This may be why CSV upload fails!');
  console.log('   CSV upload requires a LinkedIn account to validate prospects.');
}

console.log('\n' + '='.repeat(70));
