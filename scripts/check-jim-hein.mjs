#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  console.log('🔍 Searching for Jim Hein...\n');

  // Search in auth.users
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
  const jimAuth = authUsers.find(u => 
    u.email?.toLowerCase().includes('jim') || 
    u.email?.toLowerCase().includes('hein')
  );

  if (jimAuth) {
    console.log('🔐 Auth user found:');
    console.log(`   Email: ${jimAuth.email}`);
    console.log(`   ID: ${jimAuth.id}`);
    console.log(`   Created: ${jimAuth.created_at}\n`);
  } else {
    console.log('❌ No auth user found with "jim" or "hein" in email\n');
  }

  // Search in users table
  const { data: dbUsers } = await supabase
    .from('users')
    .select('*')
    .or('email.ilike.%jim%,email.ilike.%hein%,first_name.ilike.%jim%,last_name.ilike.%hein%');

  if (dbUsers && dbUsers.length > 0) {
    console.log(`💾 Found ${dbUsers.length} user(s) in database:`);
    dbUsers.forEach(user => {
      console.log(`\n   Email: ${user.email}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Workspace: ${user.current_workspace_id}`);
    });
  } else {
    console.log('❌ No users found in database\n');
  }

  // Search in workspace_members
  if (dbUsers && dbUsers.length > 0) {
    for (const user of dbUsers) {
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', user.id);

      console.log(`\n   Workspace memberships for ${user.email}:`);
      memberships?.forEach(m => {
        console.log(`     - ${m.workspaces?.name} (${m.role})`);
      });
    }
  }

  // Check for Google accounts
  if (jimAuth) {
    const { data: unipileAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', jimAuth.id);

    console.log(`\n📧 Unipile accounts for Jim:`);
    if (unipileAccounts && unipileAccounts.length > 0) {
      unipileAccounts.forEach(acc => {
        console.log(`   - ${acc.platform}: ${acc.account_email || 'No email'} (${acc.unipile_account_id})`);
      });
    } else {
      console.log('   No Unipile accounts found');
    }
  }
}

checkUser().catch(console.error);
