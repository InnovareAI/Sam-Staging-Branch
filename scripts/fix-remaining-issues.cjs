require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixRemaining() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get workspace IDs
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('name', ['Blue Label Labs', 'Sendingcell Workspace', 'InnovareAI Workspace']);

  const workspaceMap = {};
  workspaces.forEach(w => { workspaceMap[w.name] = w.id; });

  console.log('\nWorkspace IDs:');
  Object.entries(workspaceMap).forEach(([name, id]) => {
    console.log('   ' + name + ': ' + id);
  });
  console.log('');

  // Get all accounts in InnovareAI workspace
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('id, user_id, account_name')
    .eq('workspace_id', workspaceMap['InnovareAI Workspace'])
    .eq('account_type', 'linkedin');

  const fixes = [];

  for (const account of accounts) {
    const name = account.account_name;

    if (name.toLowerCase().includes('saniel')) {
      // Fix Charissa user_id
      const { data: correctUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'cs@innovareai.com')
        .single();

      if (correctUser && account.user_id !== correctUser.id) {
        fixes.push({
          type: 'user_id',
          id: account.id,
          name: account.account_name,
          action: 'Update user_id to cs@innovareai.com',
          update: { user_id: correctUser.id }
        });
      }
    }

    if (name.includes('Stan')) {
      // Move to Blue Label Labs
      fixes.push({
        type: 'workspace',
        id: account.id,
        name: account.account_name,
        action: 'Move to Blue Label Labs',
        update: { workspace_id: workspaceMap['Blue Label Labs'] }
      });
    }

    if (name.includes('Jim')) {
      // Move to Sendingcell
      fixes.push({
        type: 'workspace',
        id: account.id,
        name: account.account_name,
        action: 'Move to Sendingcell Workspace',
        update: { workspace_id: workspaceMap['Sendingcell Workspace'] }
      });
    }
  }

  console.log('Found ' + fixes.length + ' issues to fix:\n');

  fixes.forEach((fix, idx) => {
    console.log((idx + 1) + '. ' + fix.name);
    console.log('   Action: ' + fix.action);
    console.log('');
  });

  if (!process.argv.includes('--confirm')) {
    console.log('Run with --confirm to apply fixes.\n');
    return;
  }

  console.log('Applying fixes...\n');

  for (const fix of fixes) {
    const { error } = await supabase
      .from('workspace_accounts')
      .update(fix.update)
      .eq('id', fix.id);

    if (error) {
      console.log('❌ ' + fix.name + ': ' + error.message);
    } else {
      console.log('✅ ' + fix.name + ': ' + fix.action);
    }
  }

  console.log('\n✅ All fixes applied!\n');
}

fixRemaining().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
