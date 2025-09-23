#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('👥 WORKSPACES AND USERS OVERVIEW');
console.log('================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showAllUsers() {
  console.log('👤 ALL USERS:');
  console.log('=============');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, default_workspace_id, current_workspace_id, created_at')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching users:', error.message);
      return;
    }
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name} ${user.last_name || ''} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Default Workspace: ${user.default_workspace_id || 'None'}`);
      console.log(`   Current Workspace: ${user.current_workspace_id || 'None'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    return users;
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function showAllWorkspaces() {
  console.log('🏢 ALL WORKSPACES:');
  console.log('==================');
  
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, owner_id, settings, is_active, created_at')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching workspaces:', error.message);
      return;
    }
    
    workspaces.forEach((workspace, index) => {
      console.log(`${index + 1}. ${workspace.name} (${workspace.slug})`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Owner ID: ${workspace.owner_id}`);
      console.log(`   Active: ${workspace.is_active ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(workspace.created_at).toLocaleDateString()}`);
      if (workspace.settings && Object.keys(workspace.settings).length > 0) {
        console.log(`   Settings: ${JSON.stringify(workspace.settings)}`);
      }
      console.log('');
    });
    
    return workspaces;
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function showWorkspaceMembers() {
  console.log('👥 WORKSPACE MEMBERSHIPS:');
  console.log('=========================');
  
  try {
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        joined_at,
        workspace_id,
        user_id,
        workspaces (name, slug),
        users (email, first_name, last_name)
      `)
      .order('joined_at', { ascending: true });
    
    if (error) {
      console.log('❌ Error fetching memberships:', error.message);
      return;
    }
    
    // Group by workspace
    const byWorkspace = {};
    memberships.forEach(membership => {
      const workspaceName = membership.workspaces?.name || 'Unknown Workspace';
      if (!byWorkspace[workspaceName]) {
        byWorkspace[workspaceName] = [];
      }
      byWorkspace[workspaceName].push(membership);
    });
    
    Object.keys(byWorkspace).forEach(workspaceName => {
      console.log(`🏢 ${workspaceName}:`);
      byWorkspace[workspaceName].forEach(membership => {
        const user = membership.users;
        const userName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Unknown User';
        const userEmail = user?.email || 'Unknown Email';
        console.log(`   👤 ${userName} (${userEmail}) - Role: ${membership.role}`);
        console.log(`      Joined: ${new Date(membership.joined_at).toLocaleDateString()}`);
        console.log(`      User ID: ${membership.user_id}`);
      });
      console.log('');
    });
    
    return memberships;
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function showUserWorkspaceMapping() {
  console.log('🔗 USER ↔ WORKSPACE MAPPING:');
  console.log('=============================');
  
  try {
    // Get users with their workspace details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, default_workspace_id, current_workspace_id');
    
    if (usersError) {
      console.log('❌ Error fetching users:', usersError.message);
      return;
    }
    
    // Get workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name');
    
    if (workspacesError) {
      console.log('❌ Error fetching workspaces:', workspacesError.message);
      return;
    }
    
    // Create workspace lookup
    const workspaceLookup = {};
    workspaces.forEach(ws => {
      workspaceLookup[ws.id] = ws.name;
    });
    
    users.forEach(user => {
      const userName = `${user.first_name} ${user.last_name || ''}`.trim();
      console.log(`👤 ${userName} (${user.email}):`);
      
      const defaultWs = user.default_workspace_id ? workspaceLookup[user.default_workspace_id] : null;
      const currentWs = user.current_workspace_id ? workspaceLookup[user.current_workspace_id] : null;
      
      console.log(`   🏠 Default Workspace: ${defaultWs || 'None set'}`);
      console.log(`   📍 Current Workspace: ${currentWs || 'None set'}`);
      console.log('');
    });
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function showSummaryStats() {
  console.log('📊 SUMMARY STATISTICS:');
  console.log('======================');
  
  try {
    // Count users
    const { count: userCount, error: userCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Count workspaces
    const { count: workspaceCount, error: workspaceCountError } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true });
    
    // Count active workspaces
    const { count: activeWorkspaceCount, error: activeWorkspaceCountError } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // Count memberships
    const { count: membershipCount, error: membershipCountError } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true });
    
    console.log(`👥 Total Users: ${userCount || 'Error counting'}`);
    console.log(`🏢 Total Workspaces: ${workspaceCount || 'Error counting'}`);
    console.log(`✅ Active Workspaces: ${activeWorkspaceCount || 'Error counting'}`);
    console.log(`🔗 Total Memberships: ${membershipCount || 'Error counting'}`);
    
    if (workspaceCount && membershipCount) {
      const avgMembersPerWorkspace = (membershipCount / workspaceCount).toFixed(1);
      console.log(`📈 Avg Members per Workspace: ${avgMembersPerWorkspace}`);
    }
    
  } catch (err) {
    console.log('❌ Error calculating stats:', err.message);
  }
}

async function main() {
  const users = await showAllUsers();
  const workspaces = await showAllWorkspaces();
  await showWorkspaceMembers();
  await showUserWorkspaceMapping();
  await showSummaryStats();
  
  console.log('\n🎯 ANALYSIS COMPLETE');
  console.log('This shows the current user and workspace structure in the SAM AI platform.');
}

main().catch(console.error);