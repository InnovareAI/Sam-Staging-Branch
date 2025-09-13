#!/usr/bin/env node

// Script to consolidate users into the existing InnovareAI workspace
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not configured');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Users to consolidate
const usersToConsolidate = [
  'mg@innovareai.com',
  'tl@innovareai.com',
  'cl@innovareai.com',
  'cs@innovareai.com',
  'newuser@example.com',
  'samantha@truepeopleconsulting.com'
];

async function findInnovareAIWorkspace() {
  console.log('🔍 Searching for InnovareAI workspace...');
  
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .ilike('name', '%innovareai%');

    if (error) {
      console.error('❌ Error searching workspaces:', error);
      return null;
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('⚠️  No InnovareAI workspace found. Checking organizations...');
      
      // Try to find InnovareAI organization
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .ilike('name', '%innovareai%');

      if (orgError) {
        console.error('❌ Error searching organizations:', orgError);
        return null;
      }

      if (orgs && orgs.length > 0) {
        console.log('✅ Found InnovareAI organization:', orgs[0]);
        
        // Try to find workspaces in this organization
        const { data: orgWorkspaces, error: orgWsError } = await supabase
          .from('workspaces')
          .select('id, name, organization_id, owner_id')
          .eq('organization_id', orgs[0].id);

        if (!orgWsError && orgWorkspaces && orgWorkspaces.length > 0) {
          console.log('✅ Found workspaces in InnovareAI organization:', orgWorkspaces);
          return orgWorkspaces[0]; // Return the first workspace
        }
      }
      
      return null;
    }

    console.log('✅ Found InnovareAI workspace(s):', workspaces);
    return workspaces[0]; // Return the first one found
  } catch (error) {
    console.error('❌ Error in findInnovareAIWorkspace:', error);
    return null;
  }
}

async function findUsersByEmail() {
  console.log('🔍 Finding users to consolidate...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, default_workspace_id, current_workspace_id')
      .in('email', usersToConsolidate);

    if (error) {
      console.error('❌ Error finding users:', error);
      return [];
    }

    console.log(`✅ Found ${users?.length || 0} users:`, users);
    return users || [];
  } catch (error) {
    console.error('❌ Error in findUsersByEmail:', error);
    return [];
  }
}

async function getAllWorkspaces() {
  console.log('🔍 Getting all workspaces...');
  
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, organization_id, owner_id');

    if (error) {
      console.error('❌ Error getting workspaces:', error);
      return [];
    }

    console.log(`✅ Found ${workspaces?.length || 0} workspaces:`, workspaces);
    return workspaces || [];
  } catch (error) {
    console.error('❌ Error in getAllWorkspaces:', error);
    return [];
  }
}

async function addUserToWorkspace(userId, workspaceId, role = 'member') {
  console.log(`👥 Adding user ${userId} to workspace ${workspaceId}...`);
  
  try {
    // First check if user is already a member
    const { data: existing, error: checkError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (existing) {
      console.log(`   ✅ User ${userId} is already a member of workspace ${workspaceId}`);
      return true;
    }

    // Add user to workspace
    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        role: role
      })
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error adding user to workspace:`, error);
      return false;
    }

    console.log(`   ✅ Successfully added user to workspace:`, data);
    return true;
  } catch (error) {
    console.error(`   ❌ Error in addUserToWorkspace:`, error);
    return false;
  }
}

async function updateUserWorkspace(userId, workspaceId) {
  console.log(`🔄 Updating user ${userId} workspace references...`);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        default_workspace_id: workspaceId,
        current_workspace_id: workspaceId
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error updating user workspace:`, error);
      return false;
    }

    console.log(`   ✅ Successfully updated user workspace references:`, data);
    return true;
  } catch (error) {
    console.error(`   ❌ Error in updateUserWorkspace:`, error);
    return false;
  }
}

async function deleteWorkspace(workspaceId) {
  console.log(`🗑️  Deleting workspace ${workspaceId}...`);
  
  try {
    // First delete workspace members
    const { error: membersError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId);

    if (membersError) {
      console.error(`   ⚠️  Error deleting workspace members:`, membersError);
    }

    // Then delete the workspace
    const { data, error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Error deleting workspace:`, error);
      return false;
    }

    console.log(`   ✅ Successfully deleted workspace:`, data);
    return true;
  } catch (error) {
    console.error(`   ❌ Error in deleteWorkspace:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting user consolidation to InnovareAI workspace...\n');

  // Step 1: Find InnovareAI workspace
  const innovareWorkspace = await findInnovareAIWorkspace();
  if (!innovareWorkspace) {
    console.error('❌ Could not find InnovareAI workspace. Exiting.');
    process.exit(1);
  }

  console.log(`✅ Using InnovareAI workspace: ${innovareWorkspace.name} (ID: ${innovareWorkspace.id})\n`);

  // Step 2: Find users to consolidate
  const users = await findUsersByEmail();
  if (users.length === 0) {
    console.error('❌ No users found to consolidate. Exiting.');
    process.exit(1);
  }

  // Step 3: Get all workspaces to identify which ones to delete later
  const allWorkspaces = await getAllWorkspaces();
  const workspacesToDelete = [];

  // Step 4: Add users to InnovareAI workspace and update their references
  console.log('\n📋 Processing users...');
  for (const user of users) {
    console.log(`\nProcessing user: ${user.email} (ID: ${user.id})`);
    
    // Track current workspace for deletion if it's not the InnovareAI workspace
    if (user.current_workspace_id && user.current_workspace_id !== innovareWorkspace.id) {
      const currentWorkspace = allWorkspaces.find(w => w.id === user.current_workspace_id);
      if (currentWorkspace) {
        workspacesToDelete.push(currentWorkspace);
      }
    }
    
    // Add user to InnovareAI workspace
    const addedToWorkspace = await addUserToWorkspace(user.id, innovareWorkspace.id);
    if (!addedToWorkspace) {
      console.error(`   ❌ Failed to add user ${user.email} to workspace`);
      continue;
    }

    // Update user's workspace references
    const updatedReferences = await updateUserWorkspace(user.id, innovareWorkspace.id);
    if (!updatedReferences) {
      console.error(`   ❌ Failed to update workspace references for user ${user.email}`);
    }
  }

  // Step 5: Delete redundant workspaces
  console.log('\n🗑️  Cleaning up redundant workspaces...');
  
  // Remove duplicates and filter out the InnovareAI workspace
  const uniqueWorkspacesToDelete = workspacesToDelete
    .filter((workspace, index, self) => 
      index === self.findIndex(w => w.id === workspace.id) && 
      workspace.id !== innovareWorkspace.id
    );

  for (const workspace of uniqueWorkspacesToDelete) {
    console.log(`\nDeleting workspace: ${workspace.name} (ID: ${workspace.id})`);
    await deleteWorkspace(workspace.id);
  }

  console.log('\n✅ User consolidation completed!');
  console.log(`📊 Summary:`);
  console.log(`   - Consolidated ${users.length} users into InnovareAI workspace`);
  console.log(`   - Deleted ${uniqueWorkspacesToDelete.length} redundant workspaces`);
  console.log(`   - InnovareAI workspace ID: ${innovareWorkspace.id}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});