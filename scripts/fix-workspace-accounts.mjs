#!/usr/bin/env node
/**
 * Fix workspace_accounts entries for Google OAuth accounts
 * Migrates accounts from user_unipile_accounts to workspace_accounts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspaceAccounts() {
  console.log('🔧 Fixing workspace_accounts for Google OAuth accounts...\n');

  // 1. Get all Google OAuth accounts from user_unipile_accounts
  const { data: googleAccounts, error: fetchError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .like('platform', '%GOOGLE%');

  if (fetchError) {
    console.error('❌ Error fetching Google accounts:', fetchError);
    return;
  }

  console.log(`Found ${googleAccounts?.length || 0} Google accounts in user_unipile_accounts\n`);

  // 2. For each account, fetch details from Unipile API
  for (const account of googleAccounts || []) {
    console.log(`\n📧 Processing account: ${account.unipile_account_id}`);
    console.log(`   User: ${account.user_id}`);
    console.log(`   Email: ${account.account_email || 'NULL'}`);

    try {
      // Fetch from Unipile API
      const unipileResponse = await fetch(
        `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${account.unipile_account_id}`,
        {
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!unipileResponse.ok) {
        console.error(`   ❌ Unipile API error: ${unipileResponse.status}`);
        continue;
      }

      const unipileAccount = await unipileResponse.json();
      const email = unipileAccount.connection_params?.email || 
                   unipileAccount.connection_params?.im?.email || 
                   unipileAccount.name;

      console.log(`   📨 Unipile email: ${email}`);
      console.log(`   🏷️  Unipile type: ${unipileAccount.type}`);

      // Get user's current workspace
      const { data: userData } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', account.user_id)
        .single();

      const workspaceId = userData?.current_workspace_id;
      
      if (!workspaceId) {
        console.log(`   ⚠️  No workspace found for user`);
        continue;
      }

      console.log(`   🏢 Workspace: ${workspaceId}`);

      // Check if workspace_account already exists
      const { data: existing } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('unipile_account_id', account.unipile_account_id)
        .eq('workspace_id', workspaceId)
        .single();

      if (existing) {
        console.log(`   ℹ️  workspace_accounts entry already exists`);
        console.log(`      account_type: ${existing.account_type}`);
        console.log(`      account_identifier: ${existing.account_identifier}`);
        continue;
      }

      // Create workspace_account entry
      const connectionStatus = unipileAccount.sources?.some((s) => s.status === 'OK')
        ? 'connected'
        : 'pending';

      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspaceId,
          user_id: account.user_id,
          account_type: 'email',
          account_identifier: email?.toLowerCase() || account.unipile_account_id,
          account_name: unipileAccount.name || email,
          unipile_account_id: account.unipile_account_id,
          connection_status: connectionStatus,
          is_active: true,
          account_metadata: {
            unipile_instance: process.env.UNIPILE_DSN,
            provider: unipileAccount.type
          }
        });

      if (insertError) {
        console.error(`   ❌ Failed to create workspace_account:`, insertError);
      } else {
        console.log(`   ✅ Created workspace_account entry`);
        console.log(`      account_type: email`);
        console.log(`      account_identifier: ${email?.toLowerCase() || account.unipile_account_id}`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing account:`, error.message);
    }
  }

  console.log('\n✅ Done!');
}

fixWorkspaceAccounts().catch(console.error);
