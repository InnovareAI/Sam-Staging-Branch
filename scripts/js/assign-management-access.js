/**
 * Assign Management Access to InnovareAI Team
 * ==========================================
 * Give cs@innovareai.com and cl@innovareai.com management access to client workspaces
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignManagementAccess() {
  console.log('👥 Assigning management access to InnovareAI team members...');
  
  try {
    // Define management access assignments
    const managementAssignments = [
      {
        email: 'cl@innovareai.com',
        name: 'CL InnovareAI',
        role: 'admin',
        workspaces: [
          'InnovareAI Workspace',   // Already has access
          'ChillMine Workspace',    // Already has access  
          '3cubed Workspace',       // NEW
          'WT Matchmaker Workspace', // NEW
          'Sendingcell Workspace'   // NEW
        ]
      },
      {
        email: 'cs@innovareai.com', 
        name: 'Charissa Saniel',
        role: 'admin',
        workspaces: [
          'InnovareAI Workspace',   // Already has access
          'ChillMine Workspace',    // NEW
          '3cubed Workspace',       // NEW
          'WT Matchmaker Workspace', // NEW
          'Sendingcell Workspace'   // NEW
        ]
      }
    ];
    
    // Get all workspaces and users
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    console.log(`📊 Found ${workspaces?.length || 0} workspaces and ${authUsers.users.length} users`);
    
    for (const assignment of managementAssignments) {
      console.log(`\n👤 Processing ${assignment.name} (${assignment.email})...`);
      
      // Find user
      const user = authUsers.users.find(u => u.email?.toLowerCase() === assignment.email.toLowerCase());
      
      if (!user) {
        console.log(`❌ User ${assignment.email} not found in auth.users`);
        continue;
      }
      
      console.log(`✅ Found user: ${user.id}`);
      
      // Process each workspace assignment
      for (const workspaceName of assignment.workspaces) {
        const workspace = workspaces?.find(w => w.name === workspaceName);
        
        if (!workspace) {
          console.log(`   ❌ Workspace "${workspaceName}" not found`);
          continue;
        }
        
        // Check if already a member
        const { data: existingMembership } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .single();
        
        if (existingMembership) {
          console.log(`   ⏭️ Already member of ${workspaceName} (${existingMembership.role})`);
          continue;
        }
        
        // Add workspace membership
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: assignment.role,
            joined_at: new Date().toISOString()
          });
        
        if (membershipError) {
          console.log(`   ❌ Failed to add to ${workspaceName}: ${membershipError.message}`);
        } else {
          console.log(`   ✅ Added as ${assignment.role} to ${workspaceName}`);
        }
      }
      
      // Show user's final workspace memberships
      const { data: userMemberships } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id);
      
      console.log(`\n📊 ${assignment.name} final workspace access:`);
      if (userMemberships && userMemberships.length > 0) {
        for (const membership of userMemberships) {
          const workspace = workspaces?.find(w => w.id === membership.workspace_id);
          console.log(`   - ${workspace?.name || 'Unknown'} (${membership.role})`);
        }
      }
    }
    
    // Show final management team structure
    console.log('\n🏢 FINAL INNOVAREAI MANAGEMENT TEAM STRUCTURE:');
    
    const innovareTeamEmails = ['tl@innovareai.com', 'cl@innovareai.com', 'cs@innovareai.com'];
    
    for (const email of innovareTeamEmails) {
      const user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (user) {
        const { data: userMemberships } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id);
        
        console.log(`\n👤 ${email}:`);
        console.log(`   Total workspaces: ${userMemberships?.length || 0}`);
        
        if (userMemberships && userMemberships.length > 0) {
          userMemberships.forEach(membership => {
            const workspace = workspaces?.find(w => w.id === membership.workspace_id);
            const isClient = !workspace?.name.includes('InnovareAI');
            console.log(`   ${isClient ? '🎯' : '🏢'} ${workspace?.name || 'Unknown'} (${membership.role})`);
          });
        }
      }
    }
    
    // Show client workspace coverage
    console.log('\n📊 CLIENT WORKSPACE MANAGEMENT COVERAGE:');
    
    const clientWorkspaces = workspaces?.filter(w => w.name !== 'InnovareAI Workspace') || [];
    
    for (const workspace of clientWorkspaces) {
      const { data: wsMembers } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspace.id);
      
      const innovareManagers = wsMembers?.filter(m => {
        const user = authUsers.users.find(u => u.id === m.user_id);
        return user?.email?.includes('@innovareai.com');
      }) || [];
      
      console.log(`\n🎯 ${workspace.name}:`);
      console.log(`   Total members: ${wsMembers?.length || 0}`);
      console.log(`   InnovareAI managers: ${innovareManagers.length}`);
      
      innovareManagers.forEach(manager => {
        const user = authUsers.users.find(u => u.id === manager.user_id);
        console.log(`     - ${user?.email || 'Unknown'} (${manager.role})`);
      });
    }
    
    console.log('\n✅ Management access assignment complete!');
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Update super admin list in API code to include cl@innovareai.com and cs@innovareai.com');
    console.log('2. Implement workspace switcher UI for management team');
    console.log('3. Add access level detection logic');
    console.log('4. Create LinkedIn account pool management interface');
    
  } catch (error) {
    console.error('❌ Management access assignment failed:', error);
  }
}

assignManagementAccess();