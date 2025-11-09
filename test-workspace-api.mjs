// Direct test of workspace API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b';

async function test() {
  console.log('Testing workspace_members query with service role...\n');

  // Test 1: Direct query with service role
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', USER_ID)
    .eq('status', 'active');

  console.log('Memberships:', memberships);
  console.log('Error:', memberError);

  if (memberships && memberships.length > 0) {
    const workspaceIds = memberships.map(m => m.workspace_id);
    console.log('\nWorkspace IDs:', workspaceIds);

    // Test 2: Get workspace details
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .in('id', workspaceIds);

    console.log('\nWorkspaces:', workspaces);
    console.log('Workspace Error:', wsError);
  }
}

test().catch(console.error);
