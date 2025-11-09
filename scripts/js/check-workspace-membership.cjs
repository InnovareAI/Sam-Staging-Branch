// Quick script to check if user has workspace memberships
// Run with: node scripts/js/check-workspace-membership.cjs

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWorkspaceMembership() {
  const userEmail = 'tl@innovareai.com';

  console.log(`\n🔍 Checking workspace membership for: ${userEmail}\n`);

  // 1. Find user ID
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('❌ Error listing users:', userError);
    return;
  }

  const user = users.find(u => u.email === userEmail);
  if (!user) {
    console.error('❌ User not found:', userEmail);
    return;
  }

  console.log('✅ User found:', user.id);
  console.log('   Email:', user.email);
  console.log('   Created:', user.created_at);
  console.log('');

  // 2. Check workspace_members table
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id);

  if (memberError) {
    console.error('❌ Error fetching memberships:', memberError);
    return;
  }

  console.log(`📊 workspace_members records: ${memberships?.length || 0}`);
  if (memberships && memberships.length > 0) {
    memberships.forEach((m, i) => {
      console.log(`   ${i + 1}. Workspace ID: ${m.workspace_id}`);
      console.log(`      Role: ${m.role}`);
      console.log(`      Status: ${m.status}`);
      console.log(`      Created: ${m.created_at}`);
    });
  } else {
    console.log('   ⚠️  NO MEMBERSHIPS FOUND - This is the problem!');
  }
  console.log('');

  // 3. Check workspaces table
  const { data: workspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*');

  if (workspaceError) {
    console.error('❌ Error fetching workspaces:', workspaceError);
    return;
  }

  console.log(`📊 Total workspaces in system: ${workspaces?.length || 0}`);
  if (workspaces && workspaces.length > 0) {
    workspaces.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.name || w.company_name || 'Unnamed'} (${w.id})`);
      console.log(`      Owner: ${w.owner_id}`);
      console.log(`      Created: ${w.created_at}`);
    });
  }
  console.log('');

  // 4. Check if user is owner of any workspace
  if (workspaces) {
    const ownedWorkspaces = workspaces.filter(w => w.owner_id === user.id);
    console.log(`📊 Workspaces owned by user: ${ownedWorkspaces.length}`);
    if (ownedWorkspaces.length > 0) {
      ownedWorkspaces.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.name || w.company_name} (${w.id})`);
      });
    }
  }
  console.log('');

  // 5. SOLUTION: If user owns workspace but no membership, create it
  if (workspaces && memberships) {
    const ownedWorkspaces = workspaces.filter(w => w.owner_id === user.id);
    const missingMemberships = ownedWorkspaces.filter(w =>
      !memberships.find(m => m.workspace_id === w.id)
    );

    if (missingMemberships.length > 0) {
      console.log(`🔧 FOUND ISSUE: User owns ${missingMemberships.length} workspace(s) but has no membership records`);
      console.log(`   This prevents them from accessing their own workspaces!`);
      console.log('');
      console.log(`💡 FIX: Create workspace_members records:`);

      for (const workspace of missingMemberships) {
        console.log(`\nINSERT INTO workspace_members (workspace_id, user_id, role, status)`);
        console.log(`VALUES ('${workspace.id}', '${user.id}', 'owner', 'active');`);
      }
    }
  }
}

checkWorkspaceMembership().catch(console.error);
