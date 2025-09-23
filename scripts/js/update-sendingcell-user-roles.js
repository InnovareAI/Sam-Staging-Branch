/**
 * UPDATE SENDINGCELL USER ROLES
 * ============================
 * Set Jim and Dave as regular users (not admins)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSendingcellUserRoles() {
  console.log('🔧 Updating Sendingcell user roles...');
  
  try {
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    const sendingcellWorkspace = workspaces?.find(w => w.name.includes('Sendingcell'));
    
    if (!sendingcellWorkspace) {
      console.log('❌ Sendingcell workspace not found');
      return;
    }

    console.log(`✅ Found Sendingcell workspace: ${sendingcellWorkspace.id}`);

    // Get current users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    // Find Jim and Dave
    const jimUser = authUsers.users.find(u => u.email === 'jim.heim@sendingcell.com');
    const daveUser = authUsers.users.find(u => u.email === 'dave.stuteville@sendingcell.com');

    if (jimUser) {
      console.log(`✅ Found Jim: ${jimUser.email} (${jimUser.id})`);
      
      // Update Jim to user role
      const { error: jimError } = await supabase
        .from('workspace_members')
        .update({ role: 'user' })
        .eq('workspace_id', sendingcellWorkspace.id)
        .eq('user_id', jimUser.id);

      if (jimError) {
        console.log(`⚠️ Failed to update Jim's role:`, jimError.message);
      } else {
        console.log(`✅ Updated Jim to user role`);
      }
    } else {
      console.log('⚠️ Jim not found');
    }

    if (daveUser) {
      console.log(`✅ Found Dave: ${daveUser.email} (${daveUser.id})`);
      
      // Update Dave to user role
      const { error: daveError } = await supabase
        .from('workspace_members')
        .update({ role: 'user' })
        .eq('workspace_id', sendingcellWorkspace.id)
        .eq('user_id', daveUser.id);

      if (daveError) {
        console.log(`⚠️ Failed to update Dave's role:`, daveError.message);
      } else {
        console.log(`✅ Updated Dave to user role`);
      }
    } else {
      console.log('⚠️ Dave not found');
    }

    // Show final Sendingcell configuration
    console.log('\n📊 Final Sendingcell Workspace Configuration:');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    
    const sendingcellMemberships = memberships?.filter(m => m.workspace_id === sendingcellWorkspace.id) || [];
    
    console.log('\nSendingcell Workspace Users:');
    sendingcellMemberships.forEach(membership => {
      const user = finalUsers.users.find(u => u.id === membership.user_id);
      if (user) {
        console.log(`  - ${user.email} (${membership.role})`);
      }
    });

    console.log('\n✅ Sendingcell user roles updated successfully!');

  } catch (error) {
    console.error('❌ Update Sendingcell user roles failed:', error);
  }
}

updateSendingcellUserRoles();