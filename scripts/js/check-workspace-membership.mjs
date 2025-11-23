#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking workspace memberships...\n');

// Get all users
const { data: users } = await supabase.auth.admin.listUsers();
console.log(`Found ${users.users.length} users\n`);

for (const user of users.users) {
  console.log(`User: ${user.email} (${user.id})`);

  // Check workspace membership
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id);

  if (error) {
    console.error('  ❌ Error:', error);
  } else if (memberships.length === 0) {
    console.log('  ⚠️  Not in any workspace!');
  } else {
    memberships.forEach(m => {
      console.log(`  ✅ Workspace: ${m.workspace_id} (${m.role})`);
    });
  }
  console.log('');
}
