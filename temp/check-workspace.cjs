const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkWorkspace() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('Checking user workspace relationship...');
  console.log('User ID:', userId);
  console.log('Workspace ID:', workspaceId);
  console.log('');

  // Check users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('id', userId)
    .single();

  console.log('1. users table:');
  console.log('  - User exists:', !!user);
  console.log('  - Email:', user?.email);
  console.log('  - current_workspace_id:', user?.current_workspace_id);
  console.log('  - Error:', userError?.message || 'none');
  console.log('');

  // Check workspace_members table
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId);

  console.log('2. workspace_members table:');
  console.log('  - Members found:', members?.length || 0);
  if (members && members.length > 0) {
    members.forEach((m, i) => {
      console.log(`  - Member ${i+1}: workspace_id=${m.workspace_id}, role=${m.role}`);
    });
  }
  console.log('  - Error:', memberError?.message || 'none');
  console.log('');

  // Check if workspace exists
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single();

  console.log('3. workspaces table:');
  console.log('  - Workspace exists:', !!workspace);
  console.log('  - Name:', workspace?.name);
  console.log('  - Error:', workspaceError?.message || 'none');
  console.log('');

  // Check RLS policies by trying to query as the user would
  console.log('4. Testing RLS policies:');
  console.log('  - Attempting to query workspace_members as user would...');

  // Simulate what the route does
  const { data: testMembership, error: testError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  console.log('  - Test query result:', testMembership?.workspace_id || 'null');
  console.log('  - Test error:', testError?.message || 'none');
}

checkWorkspace().catch(console.error);
