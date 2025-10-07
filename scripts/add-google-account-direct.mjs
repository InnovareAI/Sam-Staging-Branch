#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAccount() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI Workspace
  const userId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'; // Real user ID
  const unipileAccountId = 'nefy7jYjS5K6X3U7ORxHNQ'; // The working Google account

  console.log('📧 Adding Google account directly to workspace_accounts...\n');

  // Fetch account from Unipile
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
    console.error('❌ Failed to fetch from Unipile:', unipileResponse.status);
    return;
  }

  const account = await unipileResponse.json();
  const email = account.connection_params?.email || 
               account.connection_params?.im?.email || 
               account.name;

  console.log(`Account details:`);
  console.log(`  Email: ${email}`);
  console.log(`  Type: ${account.type}`);
  console.log(`  Status: ${account.sources?.map(s => s.status).join(', ')}\n`);

  const connectionStatus = account.sources?.some((s) => s.status === 'OK')
    ? 'connected'
    : 'pending';

  // Insert into workspace_accounts
  const { data, error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
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
    })
    .select();

  if (error) {
    if (error.code === '23505') {
      console.log('ℹ️  Account already exists in workspace_accounts');
    } else {
      console.error('❌ Failed to insert:', error);
    }
  } else {
    console.log('✅ Successfully added to workspace_accounts!');
    console.log(data);
  }
}

addAccount().catch(console.error);
