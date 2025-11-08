require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllMemberships() {
  console.log('🔍 Checking ALL workspace_members...\n');

  const { data: members, error } = await supabase
    .from('workspace_members')
    .select(`
      id,
      workspace_id,
      user_id,
      role,
      status,
      joined_at,
      workspaces (
        name
      ),
      users (
        email
      )
    `)
    .order('workspace_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${members.length} workspace memberships\n`);

  // Group by workspace
  const byWorkspace = {};

  members.forEach(m => {
    const wsId = m.workspace_id;
    if (!byWorkspace[wsId]) {
      byWorkspace[wsId] = {
        name: m.workspaces?.name || 'Unknown',
        members: []
      };
    }
    byWorkspace[wsId].members.push(m);
  });

  console.log('📊 WORKSPACE MEMBERSHIPS:\n');

  Object.keys(byWorkspace).forEach(wsId => {
    const ws = byWorkspace[wsId];
    console.log(`${ws.name} (${ws.members.length} member${ws.members.length > 1 ? 's' : ''}):`);
    ws.members.forEach(m => {
      console.log(`  - ${m.users?.email || 'Unknown'} (${m.role}, ${m.status})`);
    });
    console.log('');
  });
}

checkAllMemberships().catch(console.error);
