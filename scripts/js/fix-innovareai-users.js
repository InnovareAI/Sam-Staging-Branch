/**
 * FIX INNOVAREAI WORKSPACE USERS
 * ===============================
 * Correct configuration for InnovareAI workspace:
 * - tl@innovareai.com (Owner)
 * - cl@innovareai.com (Admin) 
 * - cs@innovareai.com (Admin)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixInnovareAIUsers() {
  console.log('🔧 Fixing InnovareAI workspace users...');
  
  try {
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    const innovareWorkspace = workspaces?.find(w => w.name.includes('InnovareAI'));
    
    if (!innovareWorkspace) {
      console.log('❌ InnovareAI workspace not found');
      return;
    }

    console.log(`✅ Found InnovareAI workspace: ${innovareWorkspace.id}`);

    // Get current users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    console.log('\n📋 Current users:');
    authUsers.users.forEach(user => {
      console.log(`- ${user.email}`);
    });

    // Create tl@innovareai.com as owner
    console.log('\n🔄 Creating tl@innovareai.com as owner...');
    
    const existingTL = authUsers.users.find(u => u.email === 'tl@innovareai.com');
    let tlUserId;
    
    if (!existingTL) {
      const { data: tlUser, error: tlError } = await supabase.auth.admin.createUser({
        email: 'tl@innovareai.com',
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          first_name: 'Thomas',
          last_name: 'Linssen',
          organization: 'InnovareAI',
          is_super_admin: true
        }
      });

      if (tlError) {
        console.log(`❌ Failed to create tl@innovareai.com:`, tlError.message);
        return;
      } else {
        tlUserId = tlUser.user.id;
        console.log(`✅ Created tl@innovareai.com: ${tlUserId}`);
      }
    } else {
      tlUserId = existingTL.id;
      console.log(`✅ tl@innovareai.com already exists: ${tlUserId}`);
    }

    // Add tl@innovareai.com to InnovareAI workspace as owner
    const { error: tlMembershipError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: innovareWorkspace.id,
        user_id: tlUserId,
        role: 'owner'
      }, {
        onConflict: 'workspace_id,user_id'
      });

    if (tlMembershipError) {
      console.log(`⚠️ TL workspace membership failed:`, tlMembershipError.message);
    } else {
      console.log(`✅ Added tl@innovareai.com as owner to InnovareAI workspace`);
    }

    // Set as workspace owner
    await supabase
      .from('workspaces')
      .update({ owner_id: tlUserId })
      .eq('id', innovareWorkspace.id);
    console.log(`✅ Set tl@innovareai.com as workspace owner`);

    // Update cl@innovareai.com to admin role
    console.log('\n🔄 Updating cl@innovareai.com to admin role...');
    const clUser = authUsers.users.find(u => u.email === 'cl@innovareai.com');
    
    if (clUser) {
      await supabase
        .from('workspace_members')
        .update({ role: 'admin' })
        .eq('workspace_id', innovareWorkspace.id)
        .eq('user_id', clUser.id);
      console.log(`✅ Updated cl@innovareai.com to admin role`);
    }

    // Create cs@innovareai.com as admin
    console.log('\n🔄 Creating cs@innovareai.com as admin...');
    
    const existingCS = authUsers.users.find(u => u.email === 'cs@innovareai.com');
    
    if (!existingCS) {
      const { data: csUser, error: csError } = await supabase.auth.admin.createUser({
        email: 'cs@innovareai.com',
        password: 'TempPassword123!',
        email_confirm: true,
        user_metadata: {
          first_name: 'CS',
          last_name: 'InnovareAI',
          organization: 'InnovareAI'
        }
      });

      if (csError) {
        console.log(`❌ Failed to create cs@innovareai.com:`, csError.message);
      } else {
        console.log(`✅ Created cs@innovareai.com: ${csUser.user.id}`);

        // Add to InnovareAI workspace as admin
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: innovareWorkspace.id,
            user_id: csUser.user.id,
            role: 'admin'
          });

        if (membershipError) {
          console.log(`⚠️ CS workspace membership failed:`, membershipError.message);
        } else {
          console.log(`✅ Added cs@innovareai.com as admin to InnovareAI workspace`);
        }
      }
    } else {
      console.log(`✅ cs@innovareai.com already exists`);
    }

    // Remove sp@innovareai.com if it exists (incorrect user)
    console.log('\n🗑️ Checking for sp@innovareai.com to remove...');
    const spUser = authUsers.users.find(u => u.email === 'sp@innovareai.com');
    
    if (spUser) {
      console.log('🔄 Removing sp@innovareai.com (incorrect user)...');
      
      // Remove from workspace_members first
      await supabase
        .from('workspace_members')
        .delete()
        .eq('user_id', spUser.id);
      
      // Remove from auth.users
      const { error } = await supabase.auth.admin.deleteUser(spUser.id);
      if (error) {
        console.log(`⚠️ Failed to remove sp@innovareai.com:`, error.message);
      } else {
        console.log(`✅ Removed sp@innovareai.com`);
      }
    }

    // Show final InnovareAI configuration
    console.log('\n📊 Final InnovareAI Workspace Configuration:');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    
    const innovareMemberships = memberships?.filter(m => m.workspace_id === innovareWorkspace.id) || [];
    
    console.log('\nInnovareAI Workspace Users:');
    innovareMemberships.forEach(membership => {
      const user = finalUsers.users.find(u => u.id === membership.user_id);
      if (user) {
        console.log(`  - ${user.email} (${membership.role})`);
      }
    });

    console.log('\n✅ InnovareAI workspace users fixed successfully!');

  } catch (error) {
    console.error('❌ Fix InnovareAI users failed:', error);
  }
}

fixInnovareAIUsers();