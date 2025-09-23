/**
 * FIX CORRECT USERS
 * =================
 * Remove incorrect users and create the actual correct users
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCorrectUsers() {
  console.log('🔧 Fixing users with correct email addresses...');
  
  try {
    // Get current users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    
    console.log('\n👥 Current users:');
    authData.users.forEach(user => {
      console.log(`- ${user.email} (${user.id})`);
    });

    // Remove incorrect users (keeping cl@innovareai.com and sp@innovareai.com)
    const usersToRemove = [
      'tl@innovareai.com',  // Remove this - incorrect org
      'sophia@3cubed.ai',
      'admin@3cubed.ai', 
      'admin@sendingcell.com',
      'admin@wtmatchmaker.com'
    ];

    console.log('\n🗑️ Removing incorrect users...');
    for (const email of usersToRemove) {
      const user = authData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        console.log(`🔄 Removing ${email}...`);
        
        // Remove from workspace_members first
        await supabase
          .from('workspace_members')
          .delete()
          .eq('user_id', user.id);
        
        // Remove from auth.users
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) {
          console.log(`⚠️ Failed to remove ${email}:`, error.message);
        } else {
          console.log(`✅ Removed ${email}`);
        }
      }
    }

    // Create correct Sendingcell users
    const sendingcellUsers = [
      {
        email: 'jim.heim@sendingcell.com',
        firstName: 'Jim',
        lastName: 'Heim',
        role: 'admin'
      },
      {
        email: 'cathy.smith@sendingcell.com',
        firstName: 'Cathy',
        lastName: 'Smith',
        role: 'owner'
      },
      {
        email: 'dave.stuteville@sendingcell.com',
        firstName: 'Dave',
        lastName: 'Stuteville',
        role: 'admin'
      }
    ];

    const sendingcellWorkspace = workspaces?.find(w => w.name.includes('Sendingcell'));
    
    console.log('\n👥 Creating correct Sendingcell users...');
    
    for (const userData of sendingcellUsers) {
      console.log(`🔄 Creating ${userData.email}...`);
      
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          organization: 'Sendingcell'
        }
      });

      if (authError) {
        console.log(`❌ Failed to create ${userData.email}:`, authError.message);
        continue;
      }

      console.log(`✅ Created auth user: ${authUser.user.id}`);

      // Add to Sendingcell workspace
      if (sendingcellWorkspace) {
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: sendingcellWorkspace.id,
            user_id: authUser.user.id,
            role: userData.role
          });

        if (membershipError) {
          console.log(`⚠️ Workspace membership failed:`, membershipError.message);
        } else {
          console.log(`✅ Added to Sendingcell workspace as ${userData.role}`);
        }

        // Set as workspace owner if needed
        if (userData.role === 'owner') {
          await supabase
            .from('workspaces')
            .update({ owner_id: authUser.user.id })
            .eq('id', sendingcellWorkspace.id);
          console.log(`✅ Set as workspace owner`);
        }
      }
    }

    // Create tl@3cubed.ai for 3CubedAI organization
    const cubedWorkspace = workspaces?.find(w => w.name.includes('3cubed'));
    
    console.log('\n👤 Creating tl@3cubed.ai...');
    
    const { data: tlUser, error: tlError } = await supabase.auth.admin.createUser({
      email: 'tl@3cubed.ai',
      password: 'TempPassword123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'Thomas',
        last_name: 'Linssen',
        organization: '3CubedAI',
        is_super_admin: true
      }
    });

    if (tlError) {
      console.log(`❌ Failed to create tl@3cubed.ai:`, tlError.message);
    } else {
      console.log(`✅ Created tl@3cubed.ai: ${tlUser.user.id}`);

      // Add to 3CubedAI workspace as owner
      if (cubedWorkspace) {
        await supabase
          .from('workspace_members')
          .insert({
            workspace_id: cubedWorkspace.id,
            user_id: tlUser.user.id,
            role: 'owner'
          });

        // Set as workspace owner
        await supabase
          .from('workspaces')
          .update({ owner_id: tlUser.user.id })
          .eq('id', cubedWorkspace.id);
        
        console.log(`✅ Added tl@3cubed.ai as owner of 3CubedAI workspace`);
      }
    }

    // Show final status
    console.log('\n📊 Updated user list:');
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    finalUsers.users.forEach(user => {
      console.log(`- ${user.email}`);
    });

    console.log('\n✅ Sendingcell users fixed!');
    console.log('\n📝 Still need correct users for:');
    console.log('- 3CubedAI organization');
    console.log('- WT Matchmaker organization');
    console.log('\nPlease provide the correct email addresses for these organizations.');

  } catch (error) {
    console.error('❌ Fix users failed:', error);
  }
}

fixCorrectUsers();