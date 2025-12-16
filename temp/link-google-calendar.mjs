#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const THORSTEN_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const GOOGLE_ACCOUNT_ID = 'FOxV-EQmRrWqY1NUjg03EQ';  // First one created

console.log('🔗 LINKING GOOGLE CALENDAR TO WORKSPACE');
console.log('='.repeat(70));

// Check if already linked
const { data: existing } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID)
  .eq('unipile_account_id', GOOGLE_ACCOUNT_ID);

if (existing && existing.length > 0) {
  console.log('✓ Already linked:', existing[0].id);
  process.exit(0);
}

// Add the Google account to workspace_accounts
console.log('\nAdding Google Calendar account to workspace...');
const { data: newAccount, error } = await supabase
  .from('workspace_accounts')
  .insert({
    workspace_id: THORSTEN_WORKSPACE_ID,
    account_type: 'google_calendar',
    unipile_account_id: GOOGLE_ACCOUNT_ID,
    connection_status: 'connected',
    account_email: 'tl@innovareai.com',
    created_at: new Date().toISOString()
  })
  .select()
  .single();

if (error) {
  console.log(`❌ Error: ${error.message}`);
  
  // Check schema
  const { data: sample } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(1);
  console.log('\nworkspace_accounts columns:', Object.keys(sample?.[0] || {}));
} else {
  console.log(`✅ Linked: ${newAccount.id}`);
}

console.log('\n' + '='.repeat(70));
