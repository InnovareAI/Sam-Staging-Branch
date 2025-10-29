#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Finding Blue Label Labs workspace owner...\n');

// Check workspace details
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', workspaceId)
  .single();

console.log('Workspace:', workspace?.name);
console.log('Owner ID:', workspace?.owner_id || 'N/A');
console.log('Created by:', workspace?.created_by || 'N/A');

// Try to find owner user
if (workspace?.owner_id) {
  const { data: owner, error } = await supabase.auth.admin.getUserById(workspace.owner_id);
  
  if (owner) {
    console.log('\n✅ Found workspace owner:');
    console.log('   Email:', owner.user?.email || 'N/A');
    console.log('   User ID:', owner.user?.id);
    console.log('   Name:', owner.user?.user_metadata?.full_name || 'N/A');
  } else {
    console.log('\n❌ Could not fetch user:', error?.message);
  }
}

// Find all users to see who might be Stan
console.log('\n📋 All users in the system:');
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

if (users) {
  users.forEach(u => {
    const email = u.email || 'no-email';
    const name = u.user_metadata?.full_name || 'no-name';
    console.log(`   - ${email} (${name}) - ID: ${u.id}`);
  });
}
