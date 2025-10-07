#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authUserId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const dbUserId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function fixMismatch() {
  console.log('🔧 Fixing user ID mismatch...\n');
  console.log(`Auth user ID: ${authUserId}`);
  console.log(`DB user ID: ${dbUserId}\n`);

  // Option 1: Create a users table entry for the auth user ID
  console.log('Creating users table entry for auth ID...');
  
  const { error: createError } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      email: 'tl@innovareai.com',
      first_name: 'Thorsten',
      last_name: 'Linz',
      current_workspace_id: workspaceId
    });

  if (createError) {
    if (createError.code === '23505') {
      console.log('⚠️  User already exists with that email, trying update...');
      
      // Update existing user to use auth ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ id: authUserId })
        .eq('id', dbUserId);

      if (updateError) {
        console.error('❌ Failed to update user ID:', updateError);
        return;
      }
    } else {
      console.error('❌ Failed to create user:', createError);
      return;
    }
  }

  console.log('✅ User entry created for auth ID\n');

  // Add workspace membership
  const { error: memberError } = await supabase
    .from('workspace_members')
    .upsert({
      workspace_id: workspaceId,
      user_id: authUserId,
      role: 'owner'
    }, {
      onConflict: 'workspace_id,user_id'
    });

  if (memberError) {
    console.error('❌ Failed to create membership:', memberError);
  } else {
    console.log('✅ Workspace membership created\n');
  }

  // Now add workspace_accounts
  console.log('Adding Google account to workspace_accounts...\n');

  const unipileAccountId = 'nefy7jYjS5K6X3U7ORxHNQ';

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

  const connectionStatus = account.sources?.some((s) => s.status === 'OK')
    ? 'connected'
    : 'pending';

  const { error: wsAccountError } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      user_id: authUserId,
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

  if (wsAccountError) {
    if (wsAccountError.code === '23505') {
      console.log('ℹ️  Workspace account already exists');
    } else {
      console.error('❌ Failed to add workspace account:', wsAccountError);
    }
  } else {
    console.log(`✅ Added workspace_account: ${email}`);
  }

  console.log('\n🎉 Done! Email account should now appear in settings.');
}

fixMismatch().catch(console.error);
