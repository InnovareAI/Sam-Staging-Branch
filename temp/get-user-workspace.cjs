require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getUserAndWorkspace() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find user with email tl@innovareai.com
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .eq('email', 'tl@innovareai.com')
      .limit(1);

    if (userError) {
      console.log('❌ Error fetching user:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  User tl@innovareai.com not found, checking all users...');

      const { data: allUsers } = await supabase
        .from('users')
        .select('id, email, current_workspace_id')
        .limit(5);

      console.log('📋 Available users:');
      allUsers?.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email} (ID: ${u.id})`);
      });
      return;
    }

    const user = users[0];
    console.log('✅ Found user:');
    console.log(`   Email: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Workspace ID: ${user.current_workspace_id || 'Not set'}`);
    console.log('');

    if (!user.current_workspace_id) {
      console.log('⚠️  User has no current_workspace_id, checking workspaces...');

      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name, company_name')
        .limit(3);

      console.log('📋 Available workspaces:');
      workspaces?.forEach((w, i) => {
        console.log(`${i + 1}. ${w.name || w.company_name} (ID: ${w.id})`);
      });
      return;
    }

    // Get workspace details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name, company_name')
      .eq('id', user.current_workspace_id)
      .single();

    if (workspace) {
      console.log('✅ Workspace:');
      console.log(`   Name: ${workspace.name || workspace.company_name}`);
      console.log(`   ID: ${workspace.id}`);
      console.log('');
    }

    console.log('📋 Ready to re-associate LinkedIn accounts:');
    console.log(`   User: ${user.email} (${user.id})`);
    console.log(`   Workspace: ${workspace?.name} (${user.current_workspace_id})`);

    return { user, workspace };

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

getUserAndWorkspace().then(() => process.exit(0));
