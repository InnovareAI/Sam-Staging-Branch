require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('🔍 CHECKING DATABASE FOR tl@innovareai.com\n');

  // 1. Check if user exists
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'tl@innovareai.com');

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  console.log('✅ User found:');
  console.log('   Email:', user.email);
  console.log('   ID:', user.id);

  // 2. Check workspace_members
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', user.id);

  console.log('\n📋 WORKSPACE MEMBERS:');
  console.log('   Count:', members?.length || 0);
  if (members && members.length > 0) {
    members.forEach(m => {
      console.log('   -', m.workspace_id, '(role:', m.role, 'status:', m.status + ')');
    });
  } else {
    console.log('   ❌ NO WORKSPACE MEMBERS FOUND');
  }
  if (memberError) console.log('   Error:', memberError.message);

  // 3. Check total workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, owner_id');

  console.log('\n🏢 TOTAL WORKSPACES IN DATABASE:');
  console.log('   Count:', workspaces?.length || 0);
  if (workspaces && workspaces.length > 0) {
    console.log('   First 5:');
    workspaces.slice(0, 5).forEach(w => {
      console.log('   -', w.name, '(' + w.id + ')');
      console.log('     Owner:', w.owner_id);
    });
  }
  if (wsError) console.log('   Error:', wsError.message);

  // 4. Check users table for current_workspace_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  console.log('\n👤 USER TABLE:');
  if (userData) {
    console.log('   current_workspace_id:', userData.current_workspace_id || 'null');
  }
  if (userError) console.log('   Error:', userError.message);

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(60));

  if (!members || members.length === 0) {
    console.log('❌ PROBLEM: User has NO workspace_members records');
    console.log('   Solution: Add user to a workspace OR create a workspace for them');
  }

  if (workspaces && workspaces.length === 0) {
    console.log('❌ PROBLEM: Database has NO workspaces at all');
    console.log('   Solution: Create workspaces first');
  }
}

check().catch(console.error);
