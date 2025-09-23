/**
 * Setup User-Workspace-Unipile Account Linking
 * ============================================
 * Link users to workspaces and then associate Unipile accounts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupUserWorkspaceLinking() {
  console.log('🔗 Setting up user-workspace-unipile account linking...');
  
  try {
    // Get all users and workspaces
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    
    console.log(`📊 Found ${authUsers.users.length} users and ${workspaces?.length || 0} workspaces`);
    
    // Define user-workspace associations
    const userWorkspaceMap = [
      {
        email: 'tl@innovareai.com',
        workspaces: [
          { name: 'InnovareAI Workspace', role: 'owner' },
          { name: 'ChillMine Workspace', role: 'owner' },
          { name: '3cubed Workspace', role: 'admin' },
          { name: 'WT Matchmaker Workspace', role: 'admin' },
          { name: 'Sendingcell Workspace', role: 'admin' }
        ]
      },
      {
        email: 'cl@innovareai.com',
        workspaces: [
          { name: 'InnovareAI Workspace', role: 'admin' },
          { name: 'ChillMine Workspace', role: 'admin' }
        ]
      }
    ];
    
    // Add users to workspaces
    for (const userMapping of userWorkspaceMap) {
      const authUser = authUsers.users.find(u => u.email === userMapping.email);
      
      if (!authUser) {
        console.log(`❌ User ${userMapping.email} not found in auth.users`);
        continue;
      }
      
      console.log(`\n👤 Processing ${userMapping.email} (${authUser.id})`);
      
      for (const wsMapping of userMapping.workspaces) {
        const workspace = workspaces?.find(w => w.name === wsMapping.name);
        
        if (!workspace) {
          console.log(`   ❌ Workspace "${wsMapping.name}" not found`);
          continue;
        }
        
        // Check if membership already exists
        const { data: existingMembership } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', authUser.id)
          .single();
        
        if (existingMembership) {
          console.log(`   ⏭️ Already member of ${workspace.name} (${existingMembership.role})`);
          continue;
        }
        
        // Add workspace membership
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: authUser.id,
            role: wsMapping.role,
            joined_at: new Date().toISOString()
          });
        
        if (membershipError) {
          console.log(`   ❌ Failed to add to ${workspace.name}: ${membershipError.message}`);
        } else {
          console.log(`   ✅ Added as ${wsMapping.role} to ${workspace.name}`);
        }
      }
      
      // Note: users table doesn't have current_workspace_id column
      // This would need to be added if we want to track current workspace per user
      console.log(`   ℹ️ User added to workspaces (current workspace tracking not implemented)`);
    }
    
    // Now check for Unipile account auto-association
    console.log('\n🔍 Checking for Unipile account auto-association opportunities...');
    
    // Get all Unipile accounts
    const unipileResponse = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (unipileResponse.ok) {
      const unipileData = await unipileResponse.json();
      const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || []);
      const linkedInAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN');
      
      console.log(`📊 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile`);
      
      // Try to auto-associate based on email matching
      for (const userMapping of userWorkspaceMap) {
        const authUser = authUsers.users.find(u => u.email === userMapping.email);
        if (!authUser) continue;
        
        const userEmail = userMapping.email.toLowerCase();
        const matchingAccounts = linkedInAccounts.filter(acc => {
          const accountData = acc.connection_params?.im || {};
          const possibleEmails = [
            accountData.username?.toLowerCase(),
            accountData.email?.toLowerCase(),
            acc.connection_params?.email?.toLowerCase(),
            acc.metadata?.user_email?.toLowerCase()
          ].filter(Boolean);
          
          return possibleEmails.includes(userEmail);
        });
        
        console.log(`\n👤 ${userMapping.email} - Found ${matchingAccounts.length} matching LinkedIn accounts`);
        
        for (const account of matchingAccounts) {
          // Check if association already exists
          const { data: existingAssociation } = await supabase
            .from('user_unipile_accounts')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('unipile_account_id', account.id)
            .single();
          
          if (existingAssociation) {
            console.log(`   ⏭️ Account ${account.name} already associated`);
            continue;
          }
          
          // Create association
          const { error: associationError } = await supabase
            .from('user_unipile_accounts')
            .insert({
              user_id: authUser.id,
              unipile_account_id: account.id,
              platform: 'LINKEDIN',
              account_name: account.name,
              account_email: account.connection_params?.im?.email || account.connection_params?.im?.username,
              linkedin_public_identifier: account.connection_params?.im?.publicIdentifier,
              linkedin_profile_url: account.connection_params?.im?.publicIdentifier ? 
                `https://www.linkedin.com/in/${account.connection_params.im.publicIdentifier}` : null,
              connection_status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (associationError) {
            console.log(`   ❌ Failed to associate ${account.name}: ${associationError.message}`);
          } else {
            console.log(`   ✅ Associated LinkedIn account: ${account.name}`);
          }
        }
      }
    } else {
      console.log('⚠️ Failed to fetch Unipile accounts for auto-association');
    }
    
    // Final status check
    console.log('\n📊 Final linking status:');
    const { data: finalMembers } = await supabase
      .from('workspace_members')
      .select('*, workspaces(name), users(*)');
    
    const { data: finalAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('*');
    
    console.log(`✅ Total workspace memberships: ${finalMembers?.length || 0}`);
    console.log(`✅ Total Unipile associations: ${finalAssociations?.length || 0}`);
    
    finalMembers?.forEach(member => {
      console.log(`   - ${member.users?.email || 'Unknown'} → ${member.workspaces?.name} (${member.role})`);
    });
    
    finalAssociations?.forEach(assoc => {
      console.log(`   - User ${assoc.user_id} → LinkedIn: ${assoc.account_name}`);
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupUserWorkspaceLinking();