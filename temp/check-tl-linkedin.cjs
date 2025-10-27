#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTLLinkedIn() {
  // Get tl@innovareai.com user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const tlUser = users.find(u => u.email === 'tl@innovareai.com');

  if (!tlUser) {
    console.error('❌ User tl@innovareai.com not found');
    return;
  }

  console.log(`✅ Found user: ${tlUser.email} (${tlUser.id})\n`);

  // Check if they have a LinkedIn account connected
  const { data: linkedInAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', tlUser.id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (!linkedInAccount) {
    console.error('❌ No LinkedIn account connected for tl@innovareai.com\n');
    console.log('ACTION REQUIRED:');
    console.log('1. Go to https://app.meet-sam.com');
    console.log('2. Log in as tl@innovareai.com');
    console.log('3. Go to Settings → Integrations');
    console.log('4. Click "Connect LinkedIn Account"');
    console.log('5. Complete OAuth with YOUR LinkedIn credentials\n');
    return;
  }

  console.log('✅ LinkedIn Account Connected:');
  console.log(`   Account Name: ${linkedInAccount.account_name}`);
  console.log(`   Account ID: ${linkedInAccount.account_identifier}`);
  console.log(`   Unipile ID: ${linkedInAccount.unipile_account_id}`);
  console.log(`   Status: ${linkedInAccount.connection_status}`);
  console.log(`   Workspace: ${linkedInAccount.workspace_id}\n`);
}

checkTLLinkedIn().catch(console.error);
