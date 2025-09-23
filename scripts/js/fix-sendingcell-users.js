/**
 * FIX SENDINGCELL WORKSPACE USERS
 * ===============================
 * Correct configuration for Sendingcell workspace:
 * - tl@3cubed.ai (Owner)
 * - Cathy (Admin) 
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSendingcellUsers() {
  console.log('🔧 Fixing Sendingcell workspace users...');
  
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
    console.log('\n📋 Current users:');
    authUsers.users.forEach(user => {
      console.log(`- ${user.email}`);
    });

    // Find tl@3cubed.ai
    const tlUser = authUsers.users.find(u => u.email === 'tl@3cubed.ai');
    
    if (!tlUser) {
      console.log('❌ tl@3cubed.ai not found');
      return;
    }

    console.log(`✅ Found tl@3cubed.ai: ${tlUser.id}`);

    // Set tl@3cubed.ai as workspace owner
    const { error: ownerUpdateError } = await supabase
      .from('workspaces')
      .update({ owner_id: tlUser.id })
      .eq('id', sendingcellWorkspace.id);

    if (ownerUpdateError) {
      console.log(`⚠️ Failed to set workspace owner:`, ownerUpdateError.message);
    } else {
      console.log(`✅ Set tl@3cubed.ai as workspace owner`);
    }

    // Add/update tl@3cubed.ai membership as owner
    const { error: tlMembershipError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: sendingcellWorkspace.id,
        user_id: tlUser.id,
        role: 'owner'
      }, {
        onConflict: 'workspace_id,user_id'
      });

    if (tlMembershipError) {
      console.log(`⚠️ TL workspace membership failed:`, tlMembershipError.message);
    } else {
      console.log(`✅ Added tl@3cubed.ai as owner to Sendingcell workspace`);
    }

    // Find Cathy (look for cathy in email or first name)
    const cathyUser = authUsers.users.find(u => 
      u.email?.toLowerCase().includes('cathy') || 
      u.user_metadata?.first_name?.toLowerCase().includes('cathy')
    );
    
    if (cathyUser) {
      console.log(`✅ Found Cathy: ${cathyUser.email} (${cathyUser.id})`);
      
      // Add/update Cathy as admin
      const { error: cathyMembershipError } = await supabase
        .from('workspace_members')
        .upsert({
          workspace_id: sendingcellWorkspace.id,
          user_id: cathyUser.id,
          role: 'admin'
        }, {
          onConflict: 'workspace_id,user_id'
        });

      if (cathyMembershipError) {
        console.log(`⚠️ Cathy workspace membership failed:`, cathyMembershipError.message);
      } else {
        console.log(`✅ Added Cathy as admin to Sendingcell workspace`);
      }
    } else {
      console.log('⚠️ Cathy user not found');
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

    console.log('\n✅ Sendingcell workspace users fixed successfully!');

  } catch (error) {
    console.error('❌ Fix Sendingcell users failed:', error);
  }
}

fixSendingcellUsers();