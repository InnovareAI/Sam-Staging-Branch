#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSetup() {
  // Get auth user
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const authUser = authUsers.users.find(u => u.id === 'f6885ff3-deef-4781-8721-93011c990b1b');
  
  console.log('🔐 Auth user:');
  console.log(`   Email: ${authUser?.email}`);
  console.log(`   Created: ${authUser?.created_at}\n`);

  // Check users table
  const { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', 'f6885ff3-deef-4781-8721-93011c990b1b')
    .single();

  console.log('💾 Database user:');
  console.log(`   Exists: ${!!dbUser}`);
  console.log(`   Email: ${dbUser?.email || 'N/A'}`);
  console.log(`   Workspace: ${dbUser?.current_workspace_id || 'NULL'}\n`);

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .limit(5);

  console.log(`📁 Available workspaces (${workspaces?.length || 0}):`);
  workspaces?.forEach(w => {
    console.log(`   - ${w.id}: ${w.name}`);
  });

  // Check if user owns any Unipile accounts
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b');

  console.log(`\n📱 User's Unipile accounts (${accounts?.length || 0}):`);
  accounts?.forEach(a => {
    console.log(`   - ${a.platform}: ${a.unipile_account_id}`);
  });
}

checkSetup().catch(console.error);
