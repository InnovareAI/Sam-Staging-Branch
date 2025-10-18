#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setInnovareWorkspace() {
  const userEmail = 'tl@innovareai.com';
  
  console.log(`\n🔍 Looking up InnovareAI workspace...`);
  
  // Find InnovareAI workspace
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .ilike('name', '%innovare%');
  
  if (wsError || !workspaces || workspaces.length === 0) {
    console.error('❌ InnovareAI workspace not found');
    console.log('\nAvailable workspaces:');
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .limit(20);
    allWorkspaces?.forEach(ws => {
      console.log(`  - ${ws.name} (${ws.slug})`);
    });
    return;
  }
  
  const innovareWorkspace = workspaces[0];
  console.log(`✅ Found workspace: ${innovareWorkspace.name}`);
  console.log(`   ID: ${innovareWorkspace.id}`);
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();
  
  if (userError || !user) {
    console.error('❌ User not found');
    return;
  }
  
  console.log(`\n👤 User: ${user.email}`);
  console.log(`   Current workspace: ${user.current_workspace_id}`);
  
  if (user.current_workspace_id === innovareWorkspace.id) {
    console.log('✅ Already set to InnovareAI workspace');
  } else {
    // Update user's current workspace
    console.log(`\n🔄 Updating current_workspace_id...`);
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_workspace_id: innovareWorkspace.id })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('❌ Failed to update:', updateError);
      return;
    }
    
    console.log('✅ Updated current_workspace_id');
  }
  
  // Move LinkedIn accounts to InnovareAI workspace
  console.log(`\n🔄 Moving LinkedIn accounts to InnovareAI workspace...`);
  
  const { data: accounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');
  
  console.log(`   Found ${accounts?.length || 0} LinkedIn account(s)`);
  
  if (accounts && accounts.length > 0) {
    const { data: updated, error: updateAccountsError } = await supabase
      .from('workspace_accounts')
      .update({ workspace_id: innovareWorkspace.id })
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')
      .select();
    
    if (updateAccountsError) {
      console.error('❌ Failed to move accounts:', updateAccountsError);
      return;
    }
    
    console.log(`✅ Moved ${updated.length} account(s) to InnovareAI workspace`);
    updated.forEach(acc => {
      console.log(`   - ${acc.account_name} (${acc.unipile_account_id})`);
    });
  }
  
  console.log('\n🎉 Done! Now refresh your proxy modal and it should display proxy info!');
}

setInnovareWorkspace().catch(console.error);
