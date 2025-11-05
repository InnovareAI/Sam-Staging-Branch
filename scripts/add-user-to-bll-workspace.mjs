// Add tl@innovareai.com to BLL workspace
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addUserToBLL() {
  const bllWorkspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userEmail = 'tl@innovareai.com';

  console.log('🔧 ADDING USER TO BLL WORKSPACE\n');

  // 1. Find the user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found:', userEmail);
    return;
  }

  console.log('✅ Found user:', user.email);
  console.log('   User ID:', user.id);

  // 2. Check if already a member
  const { data: existingMembership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', bllWorkspaceId)
    .single();

  if (existingMembership) {
    console.log('\n✅ User is already a member of BLL workspace');
    console.log('   Role:', existingMembership.role);
    return;
  }

  // 3. Add to workspace
  console.log('\n📝 Adding user to Blue Label Labs workspace...');

  const { data: newMembership, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: bllWorkspaceId,
      user_id: user.id,
      role: 'admin', // Give admin access so they can see everything
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding user:', error);
    return;
  }

  console.log('✅ Successfully added user to workspace!');
  console.log('   Role:', newMembership.role);

  // 4. Set as current workspace
  console.log('\n📝 Setting BLL as current workspace...');

  const { error: updateError } = await supabase
    .from('users')
    .update({ current_workspace_id: bllWorkspaceId })
    .eq('id', user.id);

  if (updateError) {
    console.error('❌ Error setting current workspace:', updateError);
  } else {
    console.log('✅ BLL is now the current workspace');
  }

  // 5. Verify
  console.log('\n🔍 VERIFICATION:\n');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log(`   Total workspaces: ${memberships?.length || 0}`);
  memberships?.forEach(m => {
    console.log(`   - ${m.workspaces?.name}`);
    console.log(`     Role: ${m.role}`);
  });

  console.log('\n✅ User should now be able to see Stan\'s data in the UI!');
  console.log('   Refresh the browser to see the changes.\n');
}

addUserToBLL().catch(console.error);
