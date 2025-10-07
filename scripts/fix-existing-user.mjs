#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authUserId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const email = 'tl@innovareai.com';

async function fixUser() {
  console.log('🔍 Finding existing user by email...\n');

  // Find existing user by email
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!existingUser) {
    console.log('❌ No user found with that email');
    return;
  }

  console.log(`Found user: ${existingUser.id}`);
  console.log(`Current workspace: ${existingUser.current_workspace_id || 'NULL'}\n`);

  // Get InnovareAI workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('name', 'InnovareAI Workspace')
    .single();

  console.log(`🏢 Target workspace: ${workspace.name} (${workspace.id})\n`);

  // Update user with workspace if needed
  if (!existingUser.current_workspace_id) {
    const { error } = await supabase
      .from('users')
      .update({ current_workspace_id: workspace.id })
      .eq('id', existingUser.id);

    if (error) {
      console.error('❌ Failed to update user workspace:', error);
    } else {
      console.log('✅ Updated user workspace');
    }
  }

  // Check if workspace membership exists
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('user_id', existingUser.id)
    .single();

  if (!membership) {
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: existingUser.id,
        role: 'owner'
      });

    if (error) {
      console.error('❌ Failed to create workspace membership:', error);
    } else {
      console.log('✅ Created workspace membership');
    }
  } else {
    console.log('✅ Workspace membership already exists');
  }

  // Now migrate Unipile accounts tied to the AUTH user ID
  console.log('\n📧 Migrating Google accounts...\n');
  
  const { data: googleAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', authUserId)
    .like('platform', '%GOOGLE%');

  console.log(`Found ${googleAccounts?.length || 0} Google accounts\n`);

  for (const account of googleAccounts || []) {
    console.log(`📧 ${account.unipile_account_id}`);
    
    // Update to point to correct user ID
    const { error: updateError } = await supabase
      .from('user_unipile_accounts')
      .update({ user_id: existingUser.id })
      .eq('id', account.id);

    if (updateError) {
      console.log(`   ❌ Failed to update user_id: ${updateError.message}`);
      continue;
    }

    console.log(`   ✅ Updated user_id to ${existingUser.id}`);

    // Fetch from Unipile API
    try {
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
        console.log(`   ⚠️  Not found in Unipile (deleted)`);
        continue;
      }

      const unipileAccount = await unipileResponse.json();
      const emailAddress = unipileAccount.connection_params?.email || 
                          unipileAccount.connection_params?.im?.email || 
                          unipileAccount.name;

      const connectionStatus = unipileAccount.sources?.some((s) => s.status === 'OK')
        ? 'connected'
        : 'pending';

      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspace.id,
          user_id: existingUser.id,
          account_type: 'email',
          account_identifier: emailAddress?.toLowerCase() || account.unipile_account_id,
          account_name: unipileAccount.name || emailAddress,
          unipile_account_id: account.unipile_account_id,
          connection_status: connectionStatus,
          is_active: true,
          account_metadata: {
            unipile_instance: process.env.UNIPILE_DSN,
            provider: unipileAccount.type
          }
        });

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`   ℹ️  workspace_account already exists`);
        } else {
          console.log(`   ❌ ${insertError.message}`);
        }
      } else {
        console.log(`   ✅ Created workspace_account: ${emailAddress}`);
      }

    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }

  console.log('\n🎉 Done! Email accounts should now appear in settings.');
}

fixUser().catch(console.error);
