const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showCurrentMembers() {
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .order('workspace_id, role');

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  const wsMap = {};
  workspaces.forEach(ws => {
    wsMap[ws.id] = ws.name;
  });

  const byWorkspace = {};
  members.forEach(m => {
    const wsName = wsMap[m.workspace_id] || m.workspace_id;
    if (!byWorkspace[wsName]) byWorkspace[wsName] = [];
    byWorkspace[wsName].push({ userId: m.user_id, role: m.role });
  });

  console.log('👥 CURRENT WORKSPACE MEMBERS:\n');
  Object.entries(byWorkspace).forEach(([ws, mems]) => {
    console.log(`${ws}: ${mems.length} members`);
    mems.forEach(m => {
      console.log(`  - ${m.userId.substring(0, 8)}... (${m.role})`);
    });
    console.log('');
  });

  console.log(`Total: ${members.length} members across ${Object.keys(byWorkspace).length} workspaces`);
}

showCurrentMembers().catch(console.error);
