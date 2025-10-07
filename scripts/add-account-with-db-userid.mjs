#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAccount() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI Workspace
  const dbUserId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'; // DB user ID (EXISTS in users table)
  const authUserId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // Auth user ID
  const unipileAccountId = 'nefy7jYjS5K6X3U7ORxHNQ'; // The Google account

  console.log('📧 Adding Google account to workspace_accounts...\n');
  console.log(`Using DB user ID: ${dbUserId}`);
  console.log(`Auth user ID (in user_unipile_accounts): ${authUserId}\n`);

  // First, check if this user can see the account via API
  console.log('Note: The /api/email-providers endpoint filters by user_unipile_accounts.user_id');
  console.log('We need to either:');
  console.log('  1. Change user_unipile_accounts to use DB user ID (breaks FK)');
  console.log('  2. Add workspace_account using DB user ID (works but API won\'t find it)');
  console.log('  3. Fix the FK constraint to allow auth user ID in users table\n');

  // For now, let's add the workspace_account with DB user ID
  // and then fix the API to look up accounts differently

  const unipileResponse = await fetch(
    `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${unipileAccountId}`,
    {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!unipileResponse.ok) {
    console.error('❌ Failed to fetch from Unipile');
    return;
  }

  const account = await unipileResponse.json();
  const email = account.connection_params?.email || 
               account.connection_params?.im?.email || 
               account.name;

  console.log(`Account: ${email} (${account.type}, status: ${account.sources?.map(s => s.status).join(', ')})\n`);

  const connectionStatus = account.sources?.some((s) => s.status === 'OK')
    ? 'connected'
    : 'pending';

  const { error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      user_id: dbUserId, // Using DB user ID that EXISTS in users table
      account_type: 'email',
      account_identifier: email?.toLowerCase() || unipileAccountId,
      account_name: account.name || email,
      unipile_account_id: unipileAccountId,
      connection_status: connectionStatus,
      is_active: true,
      account_metadata: {
        unipile_instance: process.env.UNIPILE_DSN,
        provider: account.type
      }
    });

  if (error) {
    if (error.code === '23505') {
      console.log('✅ Workspace account already exists!');
    } else {
      console.error('❌ Failed:', error);
    }
  } else {
    console.log('✅ Successfully added workspace_account!');
    console.log('\n⚠️  However, the /api/email-providers endpoint needs to be fixed');
    console.log('   to look up accounts by workspace_id instead of user_unipile_accounts.user_id');
  }
}

addAccount().catch(console.error);
