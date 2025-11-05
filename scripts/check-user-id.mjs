// Check user ID for tl@innovareai.com
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserId() {
  const email = 'tl@innovareai.com';

  console.log(`🔍 Looking up user ID for: ${email}\n`);

  // Get user from auth.users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);

  // Check current workspace
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  console.log(`\n📍 Current workspace: ${profile?.current_workspace_id || 'None'}`);

  // Check workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id);

  console.log(`\n🏢 Workspace memberships: ${memberships?.length || 0}`);
  memberships?.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.workspace_id} (${m.role})`);
  });

  // Show what ID was used in test script
  console.log(`\n⚠️  Test script used: f6885ff3-deef-4781-8721-93011c990b1b`);
  console.log(`   Actual user ID: ${user.id}`);
  console.log(`   Match: ${user.id === 'f6885ff3-deef-4781-8721-93011c990b1b' ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!'}`);
}

checkUserId().catch(console.error);
