#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function showWorkspaceInfo() {
  const userEmail = 'tl@innovareai.com';
  
  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();
  
  if (!user) {
    console.error('❌ User not found');
    return;
  }
  
  console.log(`\n👤 User: ${user.email}`);
  console.log(`   Current workspace ID: ${user.current_workspace_id}`);
  
  // Get current workspace details
  if (user.current_workspace_id) {
    const { data: currentWs } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', user.current_workspace_id)
      .single();
    
    if (currentWs) {
      console.log(`\n📍 Current Workspace:`);
      console.log(`   Name: ${currentWs.name}`);
      console.log(`   Slug: ${currentWs.slug}`);
      console.log(`   ID: ${currentWs.id}`);
    }
  }
  
  // Get all workspaces user is a member of
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name, slug)')
    .eq('user_id', user.id);
  
  console.log(`\n📋 All Workspaces (${memberships?.length || 0}):`);
  memberships?.forEach(m => {
    const isCurrent = m.workspace_id === user.current_workspace_id;
    console.log(`   ${isCurrent ? '✅' : '  '} ${m.workspaces.name} (${m.role})`);
    console.log(`      ID: ${m.workspace_id}`);
  });
  
  // Show where LinkedIn accounts are
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, unipile_account_id, account_name, workspaces(name)')
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');
  
  if (accounts && accounts.length > 0) {
    console.log(`\n🔗 LinkedIn Accounts (${accounts.length}):`);
    accounts.forEach(acc => {
      const isCurrent = acc.workspace_id === user.current_workspace_id;
      console.log(`   ${isCurrent ? '✅' : '❌'} ${acc.account_name}`);
      console.log(`      Workspace: ${acc.workspaces?.name || 'Unknown'}`);
      console.log(`      ID: ${acc.unipile_account_id}`);
    });
  }
}

showWorkspaceInfo().catch(console.error);
