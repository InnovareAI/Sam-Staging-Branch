const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get all memberships
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, status')
    .order('workspace_id');

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  // Group by workspace
  const byWs = {};
  members.forEach(m => {
    if (!byWs[m.workspace_id]) byWs[m.workspace_id] = [];
    const user = users.find(u => u.id === m.user_id);
    byWs[m.workspace_id].push({ email: user?.email, role: m.role, status: m.status });
  });

  console.log('WORKSPACE MEMBERSHIPS:\n');
  Object.keys(byWs).forEach(wsId => {
    const ws = workspaces.find(w => w.id === wsId);
    console.log(ws?.name || 'Unknown', '(' + byWs[wsId].length + ' members):');
    byWs[wsId].forEach(m => {
      console.log('  -', m.email, '(' + m.role + ', ' + m.status + ')');
    });
    console.log('');
  });

  // Check your user specifically
  console.log('YOUR USER (tl@innovareai.com):');
  const tlUser = users.find(u => u.email === 'tl@innovareai.com');
  const tlMembers = members.filter(m => m.user_id === tlUser.id);
  console.log('User ID:', tlUser.id);
  console.log('Memberships:', tlMembers.length);
  tlMembers.forEach(m => {
    const ws = workspaces.find(w => w.id === m.workspace_id);
    console.log('  -', ws?.name, '(' + m.role + ')');
  });
})();
