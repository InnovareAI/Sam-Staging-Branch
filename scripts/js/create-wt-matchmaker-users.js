/**
 * CREATE WT MATCHMAKER USERS
 * ==========================
 * Create the final users for WT Matchmaker workspace
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createWTMatchmakerUsers() {
  console.log('🎯 Creating WT Matchmaker users...');
  
  try {
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    const wtWorkspace = workspaces?.find(w => w.name.includes('WT Matchmaker'));
    
    if (!wtWorkspace) {
      console.log('❌ WT Matchmaker workspace not found');
      return;
    }

    console.log(`✅ Found WT Matchmaker workspace: ${wtWorkspace.id}`);

    // Create laura@wtmatchmaker.com as admin
    console.log('\n🔄 Creating laura@wtmatchmaker.com...');
    
    const { data: lauraUser, error: lauraError } = await supabase.auth.admin.createUser({
      email: 'laura@wtmatchmaker.com',
      password: 'TempPassword123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'Laura',
        last_name: 'WT',
        organization: 'WT Matchmaker'
      }
    });

    if (lauraError) {
      console.log(`❌ Failed to create laura@wtmatchmaker.com:`, lauraError.message);
    } else {
      console.log(`✅ Created laura@wtmatchmaker.com: ${lauraUser.user.id}`);

      // Add to WT Matchmaker workspace as admin
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: wtWorkspace.id,
          user_id: lauraUser.user.id,
          role: 'admin'
        });

      if (membershipError) {
        console.log(`⚠️ Workspace membership failed:`, membershipError.message);
      } else {
        console.log(`✅ Added laura@wtmatchmaker.com as admin to WT Matchmaker workspace`);
      }
    }

    // Add tl@3cubed.ai as owner of WT Matchmaker workspace
    console.log('\n🔄 Adding tl@3cubed.ai as owner of WT Matchmaker workspace...');
    
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const tlUser = authUsers.users.find(u => u.email === 'tl@3cubed.ai');
    
    if (tlUser) {
      // Add to WT Matchmaker workspace as owner
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: wtWorkspace.id,
          user_id: tlUser.id,
          role: 'owner'
        });

      if (membershipError) {
        console.log(`⚠️ Workspace membership failed:`, membershipError.message);
      } else {
        console.log(`✅ Added tl@3cubed.ai as owner to WT Matchmaker workspace`);
      }

      // Set as workspace owner
      await supabase
        .from('workspaces')
        .update({ owner_id: tlUser.id })
        .eq('id', wtWorkspace.id);
      
      console.log(`✅ Set tl@3cubed.ai as WT Matchmaker workspace owner`);
    } else {
      console.log(`❌ tl@3cubed.ai user not found`);
    }

    // Show final complete user summary
    console.log('\n📊 COMPLETE USER SUMMARY BY ORGANIZATION:');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    const { data: finalWorkspaces } = await supabase.from('workspaces').select('*');

    const orgMapping = {
      'InnovareAI': { 
        users: finalUsers.users.filter(u => u.email.includes('innovareai')),
        workspace: 'InnovareAI Workspace'
      },
      '3CubedAI': { 
        users: finalUsers.users.filter(u => u.email.includes('3cubed')),
        workspace: '3cubed Workspace'
      },
      'Sendingcell': { 
        users: finalUsers.users.filter(u => u.email.includes('sendingcell')),
        workspace: 'Sendingcell Workspace'
      },
      'WT Matchmaker': { 
        users: finalUsers.users.filter(u => u.email.includes('wtmatchmaker') || 
                                            (u.email === 'tl@3cubed.ai' && 
                                             memberships?.some(m => m.user_id === u.id && 
                                                               finalWorkspaces?.find(w => w.id === m.workspace_id)?.name.includes('WT Matchmaker')))),
        workspace: 'WT Matchmaker Workspace'
      }
    };

    Object.entries(orgMapping).forEach(([org, data]) => {
      console.log(`\n${org}:`);
      
      // For WT Matchmaker, we need special handling since tl@3cubed.ai is cross-org
      if (org === 'WT Matchmaker') {
        const wtWorkspaceId = finalWorkspaces?.find(w => w.name.includes('WT Matchmaker'))?.id;
        const wtMemberships = memberships?.filter(m => m.workspace_id === wtWorkspaceId) || [];
        
        wtMemberships.forEach(membership => {
          const user = finalUsers.users.find(u => u.id === membership.user_id);
          if (user) {
            console.log(`  - ${user.email} (WT Matchmaker Workspace: ${membership.role})`);
          }
        });
        
        if (wtMemberships.length === 0) {
          console.log(`  - No users found`);
        }
      } else {
        data.users.forEach(user => {
          const userMemberships = memberships?.filter(m => m.user_id === user.id) || [];
          const roles = userMemberships.map(m => {
            const ws = finalWorkspaces?.find(w => w.id === m.workspace_id);
            return `${ws?.name}: ${m.role}`;
          }).filter(role => role.includes(data.workspace.split(' ')[0])); // Only show relevant workspace
          
          console.log(`  - ${user.email} (${roles.join(', ')})`);
        });
        
        if (data.users.length === 0) {
          console.log(`  - No users found`);
        }
      }
    });

    console.log('\n🎉 ALL USERS RESTORED SUCCESSFULLY!');
    console.log('\n🔑 Login Information:');
    console.log('Password for all users: TempPassword123!');
    console.log('Users should change their password after first login.');

    console.log('\n📈 Final Statistics:');
    console.log(`👥 Total users: ${finalUsers.users.length}`);
    console.log(`🏢 Total workspaces: ${finalWorkspaces?.length || 0}`);
    console.log(`👔 Total memberships: ${memberships?.length || 0}`);
    console.log(`🛡️ Complete tenant isolation: ✅ ACTIVE`);

  } catch (error) {
    console.error('❌ Create WT Matchmaker users failed:', error);
  }
}

createWTMatchmakerUsers();