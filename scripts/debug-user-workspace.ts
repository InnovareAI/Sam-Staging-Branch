/**
 * Debug specific user's workspace setup
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userEmail = 'tl@innovareai.com'; // Your email

async function debugUserWorkspace() {
  console.log(`\n🔍 Debugging workspace for: ${userEmail}\n`);

  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log('👤 User:', {
    id: user.id,
    email: user.email,
    current_workspace_id: user.current_workspace_id
  });

  // Get memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name)')
    .eq('user_id', user.id);

  console.log('\n📋 Workspace Memberships:');
  if (membershipError) {
    console.error('❌ Error:', membershipError.message);
  } else if (!memberships || memberships.length === 0) {
    console.log('❌ NO MEMBERSHIPS FOUND!');
  } else {
    memberships.forEach((m, i) => {
      const ws = (m as any).workspaces;
      console.log(`  ${i + 1}. ${ws?.name || 'Unknown'} (${m.workspace_id}) - Role: ${m.role}`);
    });
  }

  // Get all workspaces user has access to
  const { data: allWorkspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('id, name');

  console.log('\n🏢 All Workspaces:');
  if (workspacesError) {
    console.error('❌ Error:', workspacesError.message);
  } else {
    console.log(`Found ${allWorkspaces?.length || 0} total workspaces`);
  }

  // Test the exact query used in direct search
  console.log('\n🧪 Testing exact query from direct search route...');
  const { data: testMembership, error: testError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  console.log('Result:', {
    found: !!testMembership,
    workspaceId: testMembership?.workspace_id,
    error: testError?.message
  });
}

debugUserWorkspace()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
