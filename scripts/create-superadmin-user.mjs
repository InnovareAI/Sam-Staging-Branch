#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const email = 'tl@innovareai.com';

async function createUser() {
  console.log('🔧 Creating superadmin user record...\n');

  // Find InnovareAI workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('name', 'InnovareAI Workspace')
    .single();

  console.log(`🏢 Workspace: ${workspace?.name} (${workspace?.id})\n`);

  // Create user record with correct columns
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: email,
      first_name: 'Thorsten',
      last_name: 'Linz',
      current_workspace_id: workspace.id
    })
    .select()
    .single();

  if (userError) {
    console.error('❌ Failed to create user:', userError);
    return;
  }

  console.log('✅ User record created');

  // Add workspace membership
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner'
    });

  if (memberError) {
    console.error('❌ Failed to add workspace membership:', memberError);
  } else {
    console.log('✅ Workspace membership created (owner role)');
  }

  console.log('\n✅ Setup complete! Now running workspace account migration...\n');
  
  // Now migrate Google accounts to workspace_accounts
  const { data: googleAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', userId)
    .like('platform', '%GOOGLE%');

  console.log(`Found ${googleAccounts?.length || 0} Google accounts to migrate\n`);

  for (const account of googleAccounts || []) {
    console.log(`📧 Migrating: ${account.unipile_account_id}`);
    
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
        console.log(`   ⚠️  Account not found in Unipile (likely deleted)`);
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
          user_id: userId,
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
        console.log(`   ❌ ${insertError.message}`);
      } else {
        console.log(`   ✅ Created workspace_account: ${emailAddress}`);
      }

    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }

  console.log('\n🎉 All done! User should now see email accounts in settings.');
}

createUser().catch(console.error);
