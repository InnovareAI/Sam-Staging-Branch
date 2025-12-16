#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Thorsten's workspace (InnovareAI)
const THORSTEN_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 CHECKING CALENDAR CONFIGURATION');
console.log('='.repeat(70));

// 1. Check workspace_accounts for calendar connections
console.log('\n1️⃣ Workspace Accounts (calendar/integrations)...');
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID);

console.log(`   Found ${accounts?.length || 0} accounts:`);
for (const a of accounts || []) {
  console.log(`   - ${a.account_type || a.provider || 'unknown'} | Status: ${a.connection_status || a.status}`);
  console.log(`     ID: ${a.id}`);
  if (a.email) console.log(`     Email: ${a.email}`);
  if (a.error_message) console.log(`     Error: ${a.error_message}`);
}

// 2. Check calendar_connections table if exists
console.log('\n2️⃣ Calendar Connections table...');
const { data: calConnections, error: calError } = await supabase
  .from('calendar_connections')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID);

if (calError) {
  console.log(`   Table may not exist: ${calError.message}`);
} else {
  console.log(`   Found ${calConnections?.length || 0} connections:`);
  for (const c of calConnections || []) {
    console.log(`   - Provider: ${c.provider}`);
    console.log(`     Status: ${c.status}`);
    console.log(`     Email: ${c.email}`);
    if (c.error) console.log(`     Error: ${c.error}`);
  }
}

// 3. Check unipile accounts for calendar
console.log('\n3️⃣ Unipile Accounts (including calendar)...');
const { data: unipileAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID)
  .or('account_type.ilike.%calendar%,account_type.ilike.%google%,provider.ilike.%google%');

console.log(`   Found ${unipileAccounts?.length || 0} Google/Calendar accounts`);
for (const a of unipileAccounts || []) {
  console.log(`   - Type: ${a.account_type} | Provider: ${a.provider}`);
  console.log(`     Status: ${a.connection_status}`);
  console.log(`     Unipile ID: ${a.unipile_account_id}`);
  console.log(`     Created: ${a.created_at}`);
  console.log(`     Full record:`, JSON.stringify(a, null, 2));
}

// 4. Check workspace settings for booking URL
console.log('\n4️⃣ Workspace Settings...');
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', THORSTEN_WORKSPACE_ID)
  .single();

console.log(`   Workspace: ${workspace?.name}`);
console.log(`   Settings:`, JSON.stringify(workspace?.settings || {}, null, 2));

// 5. Check workspace_reply_agent_config for booking URL
console.log('\n5️⃣ Reply Agent Config...');
const { data: replyConfig } = await supabase
  .from('workspace_reply_agent_config')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID)
  .single();

if (replyConfig) {
  console.log(`   Booking URL: ${replyConfig.booking_url || 'NOT SET'}`);
  console.log(`   Calendar Integration: ${replyConfig.calendar_integration || 'NOT SET'}`);
  console.log(`   Full config:`, JSON.stringify(replyConfig, null, 2));
}

// 6. Check ALL workspace_accounts to see structure
console.log('\n6️⃣ All accounts in Thorsten workspace (full details)...');
const { data: allAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID);

for (const a of allAccounts || []) {
  console.log(`\n   Account: ${a.id}`);
  console.log(`   Type: ${a.account_type}`);
  console.log(`   Status: ${a.connection_status}`);
  console.log(`   Created: ${a.created_at}`);
  console.log(`   Updated: ${a.updated_at}`);
}

console.log('\n' + '='.repeat(70));
