#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const THORSTEN_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const GOOGLE_ACCOUNT_ID = 'jYXN8FeCTEukNSXDoaH3hA';

console.log('🔗 LINKING GOOGLE CALENDAR NOW');
console.log('='.repeat(70));

// Get user_id
const { data: member } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID)
  .eq('role', 'owner')
  .single();

console.log(`User ID: ${member.user_id}`);

// Insert the account
const { data: newAccount, error } = await supabase
  .from('workspace_accounts')
  .insert({
    workspace_id: THORSTEN_WORKSPACE_ID,
    user_id: member.user_id,
    account_type: 'google_calendar',
    account_identifier: 'tl@innovareai.com',
    account_name: 'tl@innovareai.com',
    unipile_account_id: GOOGLE_ACCOUNT_ID,
    connection_status: 'connected',
    connected_at: new Date().toISOString(),
    is_active: true,
    capabilities: { calendar: true, mail: true },
    account_metadata: {
      email: 'tl@innovareai.com',
      type: 'GOOGLE_OAUTH'
    }
  })
  .select()
  .single();

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Google Calendar linked!`);
  console.log(`   DB ID: ${newAccount.id}`);
  console.log(`   Email: tl@innovareai.com`);
  console.log(`   Unipile ID: ${GOOGLE_ACCOUNT_ID}`);
}

console.log('\n' + '='.repeat(70));
