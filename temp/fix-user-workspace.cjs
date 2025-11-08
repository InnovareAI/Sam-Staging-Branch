require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUserWorkspace() {
  console.log('🔧 Fixing user workspace membership...\n');

  const userEmail = 'tl@innovareai.com';
  const innovareWorkspace = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  console.log(`👤 User: ${user.email} (${user.id})`);

  // Check current memberships
  const { data: existingMemberships } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id);

  console.log(`\n📊 Current memberships: ${existingMemberships?.length || 0}`);

  if (!existingMemberships || existingMemberships.length === 0) {
    console.log('\n⚠️  User has no workspace memberships. Adding to InnovareAI workspace...');

    // Add user to InnovareAI workspace
    const { data: newMembership, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: innovareWorkspace,
        user_id: user.id,
        role: 'admin',
        invited_by: user.id,
        invitation_status: 'accepted'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding membership:', error);
      return;
    }

    console.log('✅ Added user to InnovareAI workspace');
    console.log(`   Role: ${newMembership.role}`);
  }

  // Update user profile to set current_workspace_id
  const { error: profileError } = await supabase
    .from('users')
    .update({ current_workspace_id: innovareWorkspace })
    .eq('id', user.id);

  if (profileError) {
    console.error('❌ Error updating user profile:', profileError);
  } else {
    console.log('✅ Set current_workspace_id in user profile');
  }

  // Verify
  const { data: verifyMemberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log('\n✅ Final workspace memberships:');
  verifyMemberships.forEach(m => {
    console.log(`   - ${m.workspaces?.name} (${m.role})`);
  });
}

fixUserWorkspace().catch(console.error);
