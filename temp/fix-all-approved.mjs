import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAll() {
  console.log('=== EXECUTING APPROVED FIXES ===\n');

  // Fix 1: Remove Tobias Linz account
  console.log('FIX 1: Remove Tobias Linz account');
  const { error: e1 } = await supabase
    .from('user_unipile_accounts')
    .delete()
    .eq('account_name', 'Tobias Linz');

  if (e1) {
    console.log('   ❌ Error:', e1.message);
  } else {
    console.log('   ✅ Deleted Tobias Linz account');
  }

  // Fix 2: Set workspace_id for accounts without one
  console.log('\nFIX 2: Set workspace_id for accounts');

  // Get accounts without workspace_id
  const { data: accountsNoWs } = await supabase
    .from('user_unipile_accounts')
    .select('id, user_id, account_name')
    .is('workspace_id', null);

  // Get workspaces with owners
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id');

  const ownerToWorkspace = {};
  for (const ws of (workspaces || [])) {
    ownerToWorkspace[ws.owner_id] = ws.id;
  }

  for (const acc of (accountsNoWs || [])) {
    const wsId = ownerToWorkspace[acc.user_id];
    if (wsId) {
      const { error } = await supabase
        .from('user_unipile_accounts')
        .update({ workspace_id: wsId })
        .eq('id', acc.id);

      if (error) {
        console.log(`   ❌ ${acc.account_name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${acc.account_name} -> workspace ${wsId.substring(0,8)}...`);
      }
    } else {
      console.log(`   ⚠️ ${acc.account_name}: No matching workspace for user`);
    }
  }

  // Fix 3: Fix campaigns with invalid linkedin_account_id
  console.log('\nFIX 3: Fix campaigns with invalid linkedin_account_id');

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, linkedin_account_id');

  // Get all valid accounts (refresh after fix 2)
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, workspace_id, account_name, connection_status');

  const validAccountIds = new Set((accounts || []).map(a => a.id));

  // Build workspace -> account mapping (prefer active accounts)
  const workspaceToAccount = {};
  for (const acc of (accounts || [])) {
    if (acc.workspace_id) {
      // Prefer active accounts
      if (!workspaceToAccount[acc.workspace_id] || acc.connection_status === 'active') {
        workspaceToAccount[acc.workspace_id] = acc.id;
      }
    }
  }

  let fixedCampaigns = 0;
  let noAccountCampaigns = 0;

  for (const camp of (campaigns || [])) {
    // Check if linkedin_account_id is invalid
    if (camp.linkedin_account_id && !validAccountIds.has(camp.linkedin_account_id)) {
      // Find correct account for this workspace
      const correctAccountId = workspaceToAccount[camp.workspace_id];

      if (correctAccountId) {
        const { error } = await supabase
          .from('campaigns')
          .update({ linkedin_account_id: correctAccountId })
          .eq('id', camp.id);

        if (error) {
          console.log(`   ❌ ${camp.name}: ${error.message}`);
        } else {
          console.log(`   ✅ ${camp.name} -> ${correctAccountId.substring(0,8)}...`);
          fixedCampaigns++;
        }
      } else {
        console.log(`   ⚠️ ${camp.name}: No account for workspace, setting to NULL`);
        await supabase
          .from('campaigns')
          .update({ linkedin_account_id: null })
          .eq('id', camp.id);
        noAccountCampaigns++;
      }
    }
  }
  console.log(`   Fixed: ${fixedCampaigns}, No account available: ${noAccountCampaigns}`);

  // Fix 4: Re-queue failed send_queue items
  console.log('\nFIX 4: Re-queue failed send_queue items');
  const { data: requeued, error: e4 } = await supabase
    .from('send_queue')
    .update({
      status: 'pending',
      error_message: null,
      scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min from now
    })
    .eq('status', 'failed')
    .select('id');

  if (e4) {
    console.log('   ❌ Error:', e4.message);
  } else {
    console.log(`   ✅ Re-queued ${requeued?.length || 0} items`);
  }

  // Fix 5: Set Brian Neirby to active
  console.log('\nFIX 5: Reconnect Brian Neirby account');
  const { error: e5 } = await supabase
    .from('user_unipile_accounts')
    .update({ connection_status: 'active' })
    .eq('account_name', 'Brian Neirby');

  if (e5) {
    console.log('   ❌ Error:', e5.message);
  } else {
    console.log('   ✅ Brian Neirby set to active');
  }

  console.log('\n=== ALL FIXES COMPLETE ===');
}

fixAll().catch(console.error);
