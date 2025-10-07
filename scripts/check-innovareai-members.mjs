#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMembers() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🏢 InnovareAI Workspace Members:\n');

  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);

  console.log(`Found ${members?.length || 0} members\n`);

  for (const member of members || []) {
    console.log(`User ID: ${member.user_id} (${member.role})`);
    
    // Check if user exists in users table
    const { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', member.user_id)
      .single();

    if (user) {
      console.log(`  ✅ User exists: ${user.email || 'No email'}`);
      console.log(`     Name: ${user.first_name} ${user.last_name}`);
    } else {
      console.log(`  ❌ User NOT in users table (orphaned membership)`);
    }

    // Check auth.users
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.find(u => u.id === member.user_id);
    
    if (authUser) {
      console.log(`  ✅ Auth user exists: ${authUser.email}`);
    } else {
      console.log(`  ❌ Auth user NOT found`);
    }

    console.log('');
  }
}

checkMembers().catch(console.error);
