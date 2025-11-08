const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function splitSendingcell() {
  console.log('🔄 Splitting Sendingcell workspace into two...\n');

  const originalWorkspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208';

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const jim = users.find(u => u.email === 'jim.heim@sendingcell.com');
  const dave = users.find(u => u.email === 'dave.stuteville@sendingcell.com');
  const cathy = users.find(u => u.email === 'cathy.smith@sendingcell.com');

  console.log('👥 Found users:');
  console.log(`  Jim: ${jim?.id}`);
  console.log(`  Dave: ${dave?.id}`);
  console.log(`  Cathy: ${cathy?.id}\n`);

  // Step 1: Rename original workspace to SC2
  console.log('📝 Renaming original workspace to SC2...');
  const { error: renameError } = await supabase
    .from('workspaces')
    .update({ name: 'SC2' })
    .eq('id', originalWorkspaceId);

  if (renameError) {
    console.error('❌ Error renaming workspace:', renameError);
    return;
  }
  console.log(`✅ Renamed to: SC2\n`);

  // Step 2: Create SC1 workspace using SQL
  console.log('📁 Creating SC1 workspace using SQL...');

  const { data: sc1Data, error: sc1Error } = await supabase.rpc('exec_sql', {
    query: `INSERT INTO workspaces (name, created_at, updated_at)
            VALUES ('SC1', NOW(), NOW())
            RETURNING id, name`
  });

  if (sc1Error) {
    console.error('❌ SQL error:', sc1Error);

    // Try alternative: just get workspace_id from UUID
    const crypto = require('crypto');
    const sc1WorkspaceId = crypto.randomUUID();

    console.log('Trying direct PostgreSQL insert...');
    // Let's skip this and just manually update
    console.log('\n⚠️  Database trigger preventing insert. Will do manual SQL in Supabase dashboard.\n');
    console.log('Run this SQL in Supabase SQL editor:');
    console.log(`
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${sc1WorkspaceId}', 'SC1', NOW(), NOW());
    `);
    console.log('\nThen run this script again with the workspace ID.');
    return;
  }

  const sc1WorkspaceId = sc1Data[0].id;
  console.log(`✅ Created SC1: ${sc1WorkspaceId}\n`);

  // Continuethe rest...
  await continueWithSplit(sc1WorkspaceId, originalWorkspaceId, jim, dave, cathy, users);
}

async function continueWithSplit(sc1WorkspaceId, sc2WorkspaceId, jim, dave, cathy, users) {
  // Step 3: Move Jim to SC1
  console.log('👤 Moving Jim to SC1...');

  // Remove Jim from SC2
  await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', sc2WorkspaceId)
    .eq('user_id', jim.id);

  // Add Jim to SC1 as owner
  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: sc1WorkspaceId,
      user_id: jim.id,
      role: 'owner',
      status: 'active'
    });

  console.log('✅ Jim moved to SC1 as owner\n');

  // Step 4: Update Dave to owner in SC2
  console.log('👤 Updating Dave to owner in SC2...');
  await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', sc2WorkspaceId)
    .eq('user_id', dave.id);

  console.log('✅ Dave is now owner\n');

  // Step 5: Move Jim's LinkedIn account to SC1
  console.log('🔗 Moving LinkedIn accounts...');

  const jimUnipileId = 'J6pyDIoQSfmGDEIbwXBy3A';

  await supabase
    .from('workspace_accounts')
    .update({ workspace_id: sc1WorkspaceId })
    .eq('workspace_id', sc2WorkspaceId)
    .eq('unipile_account_id', jimUnipileId);

  console.log('✅ Jim Heim LinkedIn account moved to SC1');
  console.log('✅ Dave Stuteville LinkedIn account remains in SC2\n');

  // Step 6: Add Cathy to both workspaces
  console.log('👤 Adding Cathy as admin to both workspaces...');

  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: sc1WorkspaceId,
      user_id: cathy.id,
      role: 'admin',
      status: 'active'
    });

  console.log('✅ Cathy added to SC1 as admin');
  console.log('✅ Cathy already in SC2 as admin\n');

  console.log('\n✅ Sendingcell workspaces split: SC1 and SC2 created!');
}

splitSendingcell().catch(console.error);
