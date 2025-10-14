import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

async function debugMembers() {
  console.log('🔍 Debugging workspace_members table...\n');

  // Direct query without joins
  console.log('1️⃣ workspace_members (no joins):');
  const { data: directMembers, error: error1 } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID);

  console.log(`   Found: ${directMembers?.length || 0} members`);
  if (error1) console.log(`   Error: ${error1.message}`);
  if (directMembers) {
    directMembers.forEach(m => {
      console.log(`   - User ID: ${m.user_id}, Role: ${m.role}`);
    });
  }
  console.log('');

  // Check if Stan is in there
  console.log('2️⃣ Stan in workspace_members?');
  const { data: stanMember, error: error2 } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .eq('user_id', STAN_USER_ID)
    .single();

  if (stanMember) {
    console.log('   ✅ YES - Stan is a member');
    console.log(`   Role: ${stanMember.role}`);
  } else if (error2) {
    console.log('   ❌ NO - Stan is NOT a member');
    console.log(`   Error: ${error2.message}`);
  }
  console.log('');

  // Check Stan's auth.users record
  console.log('3️⃣ Stan in auth.users?');
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const stanAuth = users.find(u => u.id === STAN_USER_ID);

  if (stanAuth) {
    console.log('   ✅ YES - Stan exists in auth');
    console.log(`   Email: ${stanAuth.email}`);
  } else {
    console.log('   ❌ NO - Stan NOT in auth.users');
  }
  console.log('');

  // Check public.users table
  console.log('4️⃣ Stan in public.users?');
  const { data: stanPublicUser, error: error3 } = await supabase
    .from('users')
    .select('*')
    .eq('id', STAN_USER_ID)
    .single();

  if (stanPublicUser) {
    console.log('   ✅ YES - Stan exists in public.users');
    console.log(`   Email: ${stanPublicUser.email}`);
    console.log(`   Current Workspace: ${stanPublicUser.current_workspace_id || 'None'}`);
  } else if (error3) {
    console.log('   ❌ NO - Stan NOT in public.users');
    console.log(`   Error: ${error3.message}`);
  }
  console.log('');

  // Try the join query
  console.log('5️⃣ workspace_members WITH users join:');
  const { data: joinedMembers, error: error4 } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, raw_user_meta_data)')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID);

  console.log(`   Found: ${joinedMembers?.length || 0} members`);
  if (error4) console.log(`   Error: ${error4.message}`);
  if (joinedMembers) {
    joinedMembers.forEach(m => {
      console.log(`   - ${m.users?.email || 'NO EMAIL'} (${m.role})`);
    });
  }
}

debugMembers();
