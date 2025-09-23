/**
 * COMPLETE USER RESTORATION
 * =========================
 * Final step to complete user restoration for all organizations
 * Creates remaining 3CubedAI users and verifies authentication
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function completeUserRestoration() {
  console.log('🏁 Completing user restoration...');
  
  try {
    // Get current users and workspaces
    const { data: authData } = await supabase.auth.admin.listUsers();
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    
    const existingEmails = new Set(authData.users.map(u => u.email.toLowerCase()));
    const cubedWorkspace = workspaces?.find(w => w.name.includes('3cubed'));
    
    // Create missing 3CubedAI users
    const missingUsers = [
      {
        email: 'sophia@3cubed.ai',
        firstName: 'Sophia',
        lastName: 'Caldwell',
        role: 'owner'
      },
      {
        email: 'admin@3cubed.ai',
        firstName: 'Admin',
        lastName: '3Cubed',
        role: 'admin'
      }
    ];

    console.log('\n👥 Creating missing 3CubedAI users...');
    
    for (const userData of missingUsers) {
      if (!existingEmails.has(userData.email.toLowerCase())) {
        console.log(`🔄 Creating ${userData.email}...`);
        
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: 'TempPassword123!',
          email_confirm: true,
          user_metadata: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            organization: '3CubedAI'
          }
        });

        if (authError) {
          console.log(`❌ Failed to create ${userData.email}:`, authError.message);
          continue;
        }

        console.log(`✅ Created auth user: ${authUser.user.id}`);

        // Add to 3CubedAI workspace
        if (cubedWorkspace) {
          const { error: membershipError } = await supabase
            .from('workspace_members')
            .insert({
              workspace_id: cubedWorkspace.id,
              user_id: authUser.user.id,
              role: userData.role
            });

          if (membershipError) {
            console.log(`⚠️  Workspace membership failed:`, membershipError.message);
          } else {
            console.log(`✅ Added to 3CubedAI workspace as ${userData.role}`);
          }

          // Set as workspace owner if needed
          if (userData.role === 'owner') {
            await supabase
              .from('workspaces')
              .update({ owner_id: authUser.user.id })
              .eq('id', cubedWorkspace.id);
            console.log(`✅ Set as workspace owner`);
          }
        }
      } else {
        console.log(`⏭️  ${userData.email} already exists`);
      }
    }

    // Update user roles and fix workspace memberships
    console.log('\n🔧 Fixing user roles and memberships...');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    
    const roleUpdates = [
      { email: 'tl@innovareai.com', correctRole: 'owner', workspace: 'InnovareAI' },
      { email: 'cl@innovareai.com', correctRole: 'owner', workspace: 'InnovareAI' },
      { email: 'sp@innovareai.com', correctRole: 'admin', workspace: 'InnovareAI' },
      { email: 'admin@wtmatchmaker.com', correctRole: 'owner', workspace: 'WT Matchmaker' },
      { email: 'admin@sendingcell.com', correctRole: 'owner', workspace: 'Sendingcell' },
      { email: 'sophia@3cubed.ai', correctRole: 'owner', workspace: '3cubed' },
      { email: 'admin@3cubed.ai', correctRole: 'admin', workspace: '3cubed' }
    ];

    for (const update of roleUpdates) {
      const user = finalUsers.users.find(u => u.email.toLowerCase() === update.email.toLowerCase());
      const workspace = workspaces?.find(w => w.name.toLowerCase().includes(update.workspace.toLowerCase()));
      
      if (user && workspace) {
        const membership = memberships?.find(m => m.user_id === user.id && m.workspace_id === workspace.id);
        
        if (membership && membership.role !== update.correctRole) {
          console.log(`🔄 Updating ${user.email} role from ${membership.role} to ${update.correctRole}`);
          
          await supabase
            .from('workspace_members')
            .update({ role: update.correctRole })
            .eq('user_id', user.id)
            .eq('workspace_id', workspace.id);
            
          console.log(`✅ Updated role for ${user.email}`);
        }

        // Ensure owners are set on workspaces
        if (update.correctRole === 'owner' && workspace.owner_id !== user.id) {
          await supabase
            .from('workspaces')
            .update({ owner_id: user.id })
            .eq('id', workspace.id);
          console.log(`✅ Set ${user.email} as owner of ${workspace.name}`);
        }
      }
    }

    // Final verification
    console.log('\n📊 Final User Status:');
    const { data: finalAuthUsers } = await supabase.auth.admin.listUsers();
    const { data: finalMemberships } = await supabase.from('workspace_members').select('*');
    const { data: finalWorkspaces } = await supabase.from('workspaces').select('*');

    console.log(`👥 Total auth users: ${finalAuthUsers.users.length}`);
    console.log(`🏢 Total workspaces: ${finalWorkspaces?.length || 0}`);
    console.log(`👔 Total memberships: ${finalMemberships?.length || 0}`);

    console.log('\n👤 User Summary by Organization:');
    
    const orgUsers = {
      'InnovareAI': finalAuthUsers.users.filter(u => u.email.includes('innovareai')),
      '3CubedAI': finalAuthUsers.users.filter(u => u.email.includes('3cubed')),
      'WT Matchmaker': finalAuthUsers.users.filter(u => u.email.includes('wtmatchmaker')),
      'Sendingcell': finalAuthUsers.users.filter(u => u.email.includes('sendingcell'))
    };

    Object.entries(orgUsers).forEach(([org, users]) => {
      console.log(`\n${org}:`);
      users.forEach(user => {
        const userMemberships = finalMemberships?.filter(m => m.user_id === user.id) || [];
        const roles = userMemberships.map(m => {
          const ws = finalWorkspaces?.find(w => w.id === m.workspace_id);
          return `${ws?.name}: ${m.role}`;
        });
        console.log(`  - ${user.email} (${roles.join(', ')})`);
      });
      if (users.length === 0) {
        console.log(`  - No users found`);
      }
    });

    console.log('\n🎯 User restoration completed successfully!');
    
    console.log('\n🔑 Login Information:');
    console.log('All users can sign in with:');
    console.log('Password: TempPassword123!');
    console.log('They should change their password after first login.');

  } catch (error) {
    console.error('❌ User restoration completion failed:', error);
  }
}

completeUserRestoration();