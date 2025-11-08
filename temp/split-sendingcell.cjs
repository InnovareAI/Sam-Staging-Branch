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

  // Step 1: Create Jim's workspace
  console.log('📁 Creating workspace for Jim Heim (SC1)...');
  const { data: jimWorkspaceArray, error: jimWsError } = await supabase
    .from('workspaces')
    .insert({
      name: 'SC1',
      created_at: new Date().toISOString()
    })
    .select();

  if (jimWsError) {
    console.error('❌ Error creating Jim workspace:', jimWsError);
    return;
  }
  const jimWorkspace = jimWorkspaceArray[0];
  console.log(`✅ Created: ${jimWorkspace.name} (${jimWorkspace.id})\n`);

  // Step 2: Rename original workspace for Dave
  console.log('📝 Renaming original workspace for Dave (SC2)...');
  const { error: renameError } = await supabase
    .from('workspaces')
    .update({ name: 'SC2' })
    .eq('id', originalWorkspaceId);

  if (renameError) {
    console.error('❌ Error renaming workspace:', renameError);
    return;
  }
  console.log(`✅ Renamed to: SC2\n`);

  // Step 3: Move Jim to his new workspace
  console.log('👤 Moving Jim to new workspace...');

  // Remove Jim from original workspace
  const { error: removeJimError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', originalWorkspaceId)
    .eq('user_id', jim.id);

  if (removeJimError) {
    console.error('❌ Error removing Jim:', removeJimError);
  }

  // Add Jim to his new workspace as owner
  const { error: addJimError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: jimWorkspace.id,
      user_id: jim.id,
      role: 'owner',
      status: 'active'
    });

  if (addJimError) {
    console.error('❌ Error adding Jim to new workspace:', addJimError);
  } else {
    console.log('✅ Jim moved to new workspace as owner\n');
  }

  // Step 4: Update Dave to owner in his workspace
  console.log('👤 Updating Dave to owner in his workspace...');
  const { error: updateDaveError } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', originalWorkspaceId)
    .eq('user_id', dave.id);

  if (updateDaveError) {
    console.error('❌ Error updating Dave:', updateDaveError);
  } else {
    console.log('✅ Dave is now owner\n');
  }

  // Step 5: Move Jim's LinkedIn account to his workspace
  console.log('🔗 Moving LinkedIn accounts...');

  const jimUnipileId = 'J6pyDIoQSfmGDEIbwXBy3A';

  const { error: moveJimAccountError } = await supabase
    .from('workspace_accounts')
    .update({ workspace_id: jimWorkspace.id })
    .eq('workspace_id', originalWorkspaceId)
    .eq('unipile_account_id', jimUnipileId);

  if (moveJimAccountError) {
    console.error('❌ Error moving Jim LinkedIn account:', moveJimAccountError);
  } else {
    console.log('✅ Jim Heim LinkedIn account moved to his workspace');
  }

  console.log('✅ Dave Stuteville LinkedIn account remains in his workspace\n');

  // Step 6: Handle Cathy - add her to both workspaces as admin
  console.log('👤 Adding Cathy as admin to both workspaces...');

  // Add to Jim's workspace
  const { error: cathyJimError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: jimWorkspace.id,
      user_id: cathy.id,
      role: 'admin',
      status: 'active'
    });

  if (cathyJimError) {
    console.error('❌ Error adding Cathy to Jim workspace:', cathyJimError);
  } else {
    console.log('✅ Cathy added to Jim workspace as admin');
  }

  // Update Cathy in Dave's workspace (she's already there)
  console.log('✅ Cathy already in Dave workspace as admin\n');

  // Verification
  console.log('═══════════════════════════════════════════════════\n');
  console.log('🔍 VERIFICATION:\n');

  // Jim's workspace
  const { data: jimMembers } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', jimWorkspace.id);

  const { data: jimAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_name, unipile_account_id')
    .eq('workspace_id', jimWorkspace.id)
    .eq('account_type', 'linkedin');

  console.log(`SC1 (Jim Heim):`);
  console.log(`  Members: ${jimMembers?.length || 0}`);
  jimMembers?.forEach(m => {
    const user = users.find(u => u.id === m.user_id);
    console.log(`    - ${user?.email} (${m.role})`);
  });
  console.log(`  LinkedIn Accounts: ${jimAccounts?.length || 0}`);
  jimAccounts?.forEach(a => {
    console.log(`    - ${a.account_name}`);
  });

  // Dave's workspace
  const { data: daveMembers } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', originalWorkspaceId);

  const { data: daveAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_name, unipile_account_id')
    .eq('workspace_id', originalWorkspaceId)
    .eq('account_type', 'linkedin');

  console.log(`\nSC2 (Dave Stuteville):`);
  console.log(`  Members: ${daveMembers?.length || 0}`);
  daveMembers?.forEach(m => {
    const user = users.find(u => u.id === m.user_id);
    console.log(`    - ${user?.email} (${m.role})`);
  });
  console.log(`  LinkedIn Accounts: ${daveAccounts?.length || 0}`);
  daveAccounts?.forEach(a => {
    console.log(`    - ${a.account_name}`);
  });

  console.log('\n✅ Sendingcell workspaces split: SC1 and SC2 created!');
}

splitSendingcell().catch(console.error);
