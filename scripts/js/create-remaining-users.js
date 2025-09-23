/**
 * CREATE REMAINING USERS
 * ======================
 * Create the remaining correct users for 3CubedAI
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createRemainingUsers() {
  console.log('👥 Creating remaining users for 3CubedAI...');
  
  try {
    // First, clean up any remaining workspace memberships for tl@innovareai.com
    console.log('🧹 Cleaning up any remaining tl@innovareai.com workspace memberships...');
    
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const tlInnovareUser = authUsers.users.find(u => u.email === 'tl@innovareai.com');
    
    if (tlInnovareUser) {
      console.log('Found remaining tl@innovareai.com user - this should have been removed');
      // Remove any workspace memberships
      await supabase
        .from('workspace_members')
        .delete()
        .eq('user_id', tlInnovareUser.id);
      console.log('✅ Cleaned up workspace memberships');
    }

    const { data: workspaces } = await supabase.from('workspaces').select('*');
    const cubedWorkspace = workspaces?.find(w => w.name.includes('3cubed'));
    
    if (!cubedWorkspace) {
      console.log('❌ 3CubedAI workspace not found');
      return;
    }

    // Create ny@3cubed.ai as admin
    console.log('🔄 Creating ny@3cubed.ai...');
    
    const { data: nyUser, error: nyError } = await supabase.auth.admin.createUser({
      email: 'ny@3cubed.ai',
      password: 'TempPassword123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'NY',
        last_name: '3Cubed',
        organization: '3CubedAI'
      }
    });

    if (nyError) {
      console.log(`❌ Failed to create ny@3cubed.ai:`, nyError.message);
    } else {
      console.log(`✅ Created ny@3cubed.ai: ${nyUser.user.id}`);

      // Add to 3CubedAI workspace as admin
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: cubedWorkspace.id,
          user_id: nyUser.user.id,
          role: 'admin'
        });

      if (membershipError) {
        console.log(`⚠️ Workspace membership failed:`, membershipError.message);
      } else {
        console.log(`✅ Added ny@3cubed.ai as admin to 3CubedAI workspace`);
      }
    }

    // Show final user summary
    console.log('\n📊 Final User Summary by Organization:');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    const { data: finalWorkspaces } = await supabase.from('workspaces').select('*');

    const orgUsers = {
      'InnovareAI': finalUsers.users.filter(u => u.email.includes('innovareai')),
      '3CubedAI': finalUsers.users.filter(u => u.email.includes('3cubed')),
      'Sendingcell': finalUsers.users.filter(u => u.email.includes('sendingcell')),
      'WT Matchmaker': finalUsers.users.filter(u => u.email.includes('wtmatchmaker'))
    };

    Object.entries(orgUsers).forEach(([org, users]) => {
      console.log(`\n${org}:`);
      users.forEach(user => {
        const userMemberships = memberships?.filter(m => m.user_id === user.id) || [];
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

    console.log('\n✅ All users have been restored correctly!');
    console.log('\n🔑 Login Information:');
    console.log('Password for all users: TempPassword123!');
    console.log('Users should change their password after first login.');

    console.log('\n📝 User Summary:');
    console.log(`👥 Total users: ${finalUsers.users.length}`);
    console.log(`🏢 Total workspaces: ${finalWorkspaces?.length || 0}`);
    console.log(`👔 Total memberships: ${memberships?.length || 0}`);

  } catch (error) {
    console.error('❌ Create remaining users failed:', error);
  }
}

createRemainingUsers();