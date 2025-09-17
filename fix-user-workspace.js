// Script to fix user workspace issue
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUserWorkspace() {
  console.log('🔧 FIXING USER WORKSPACE ACCESS');
  console.log('=' .repeat(80));
  
  try {
    const userId = 'a948a612-9a42-41aa-84a9-d368d9090054'; // tl@innovareai.com
    const workspaceId = 'c86ecbcf-a28d-445d-b030-485804c9255d';
    
    console.log(`👤 User: ${userId}`);
    console.log(`🏢 Workspace: ${workspaceId}`);
    console.log('');
    
    // Step 1: Check current user workspace
    console.log('📋 Step 1: Check current user workspace');
    const { data: currentUser } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single();
    
    console.log(`   Current workspace: ${currentUser?.current_workspace_id || 'NULL'}`);
    
    // Step 2: Check if user is member of target workspace
    console.log('📋 Step 2: Check workspace membership');
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();
    
    if (membership) {
      console.log(`   ✅ User is member of workspace (role: ${membership.role})`);
    } else {
      console.log('   ❌ User is NOT a member of workspace');
      
      // Add user to workspace
      console.log('📋 Step 2b: Adding user to workspace');
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'admin',
          status: 'active'
        });
      
      if (membershipError) {
        console.error('   ❌ Failed to add membership:', membershipError);
      } else {
        console.log('   ✅ Added user to workspace as admin');
      }
    }
    
    // Step 3: Update user's current workspace
    console.log('📋 Step 3: Update user current workspace');
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_workspace_id: workspaceId })
      .eq('id', userId);
    
    if (updateError) {
      console.error('   ❌ Failed to update current workspace:', updateError);
    } else {
      console.log('   ✅ Updated user current workspace');
    }
    
    // Step 4: Verify fix
    console.log('📋 Step 4: Verify fix');
    const { data: verifyUser } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single();
    
    const { data: verifyMembership } = await supabase
      .from('workspace_members')
      .select('role, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();
    
    console.log(`   Current workspace: ${verifyUser?.current_workspace_id}`);
    console.log(`   Membership: ${verifyMembership?.role} (${verifyMembership?.status})`);
    
    if (verifyUser?.current_workspace_id === workspaceId && verifyMembership) {
      console.log('');
      console.log('🎉 SUCCESS: User workspace access fixed!');
      console.log('   User should now be able to:');
      console.log('   - Load workspaces in the app');
      console.log('   - Access LinkedIn accounts in this workspace');
      console.log('   - See LinkedIn status as connected');
    } else {
      console.log('');
      console.log('❌ FAILED: Fix did not work correctly');
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the fix
fixUserWorkspace();