#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const THORSTEN_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const GOOGLE_ACCOUNT_ID = 'FOxV-EQmRrWqY1NUjg03EQ';

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
    account_identifier: 'tl@innovareai.com',
    account_name: 'tl@innovareai.com',
    unipile_account_id: GOOGLE_ACCOUNT_ID,
    connection_status: 'connected',
    connected_at: new Date().toISOString(),
    is_active: true,
    capabilities: { calendar: true, mail: true },
    account_metadata: {
      email: 'tl@innovareai.com',
      type: 'GOOGLE_OAUTH',
      connected_via: 'unipile'
    }
  })
  .select()
  .single();

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Linked Google Calendar: ${newAccount.id}`);
}

// Now let's also update the reply agent config with the booking URL
console.log('\n📅 What is your booking URL? (e.g., https://cal.com/thorsten)');
console.log('   I see in your reply guidelines you mentioned: https://cal.com/thorsten');
console.log('   Let me add that to the Reply Agent config...');

const { error: configError } = await supabase
  .from('workspace_reply_agent_config')
  .update({
    booking_url: 'https://cal.com/thorsten',
    calendar_integration: GOOGLE_ACCOUNT_ID,
    updated_at: new Date().toISOString()
  })
  .eq('workspace_id', THORSTEN_WORKSPACE_ID);

if (configError) {
  console.log(`   ⚠️ Couldn't update config: ${configError.message}`);
  
  // Check if columns exist
  const { data: configSample } = await supabase
    .from('workspace_reply_agent_config')
    .select('*')
    .limit(1);
  console.log('   Available columns:', Object.keys(configSample?.[0] || {}));
} else {
  console.log(`   ✅ Booking URL set: https://cal.com/thorsten`);
}

console.log('\n' + '='.repeat(70));
