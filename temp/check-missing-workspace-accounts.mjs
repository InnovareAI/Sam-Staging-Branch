import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get campaigns without linkedin_account_id
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, status')
    .is('linkedin_account_id', null);

  // Get workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id');

  const wsMap = {};
  for (const ws of (workspaces || [])) {
    wsMap[ws.id] = ws;
  }

  console.log('Campaigns WITHOUT linkedin_account_id:\n');
  const missingWorkspaceIds = new Set();
  for (const c of (campaigns || [])) {
    const ws = wsMap[c.workspace_id];
    console.log(`  - ${c.name} (${c.status})`);
    console.log(`    Workspace: ${ws?.name} | ID: ${c.workspace_id}`);
    missingWorkspaceIds.add(c.workspace_id);
  }

  // Get all accounts
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, workspace_id, user_id, connection_status');

  console.log('\n\nALL LinkedIn accounts in user_unipile_accounts:\n');
  for (const a of (accounts || [])) {
    const ws = wsMap[a.workspace_id];
    console.log(`  - ${a.account_name} (${a.connection_status})`);
    console.log(`    workspace_id: ${a.workspace_id || 'NULL'} | workspace: ${ws?.name || 'NONE'}`);
    console.log(`    user_id: ${a.user_id}`);
    console.log('');
  }

  // Find workspaces that need accounts
  console.log('\nWorkspaces that need LinkedIn accounts linked:\n');
  const accountWorkspaces = new Set((accounts || []).map(a => a.workspace_id).filter(Boolean));

  for (const wsId of missingWorkspaceIds) {
    if (!accountWorkspaces.has(wsId)) {
      const ws = wsMap[wsId];
      console.log(`  ❌ ${ws?.name} (${wsId})`);
      console.log(`     Owner: ${ws?.owner_id}`);

      // Find account by owner
      const ownerAccount = (accounts || []).find(a => a.user_id === ws?.owner_id);
      if (ownerAccount) {
        console.log(`     ✅ Found account: ${ownerAccount.account_name} (${ownerAccount.id})`);
        console.log(`        -> Should link this account to workspace ${wsId}`);
      }
      console.log('');
    }
  }
}

check().catch(console.error);
