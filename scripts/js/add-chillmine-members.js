/**
 * Add New Members to ChillMine Workspace
 * =====================================
 * Add Pete Noble and Martin Schechtner to ChillMine workspace
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addChillMineMembers() {
  console.log('👥 Adding new members to ChillMine workspace...');
  
  try {
    // Get ChillMine workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*')
      .eq('name', 'ChillMine Workspace');
    
    const chillmineWorkspace = workspaces?.[0];
    
    if (!chillmineWorkspace) {
      console.log('❌ ChillMine Workspace not found');
      return;
    }
    
    console.log(`✅ Found ChillMine Workspace: ${chillmineWorkspace.id}`);
    
    // Define new members to add
    const newMembers = [
      {
        email: 'pete@chillmine.io',
        name: 'Pete Noble',
        role: 'admin',
        linkedinAccount: 'Peter Noble' // Potential match from Unipile
      },
      {
        email: 'martin@chillmine.io', 
        name: 'Martin Schechtner',
        role: 'admin',
        linkedinAccount: 'Martin Schechtner' // Potential match from Unipile
      }
    ];
    
    // Get all auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    console.log(`📊 Total auth users: ${authUsers.users.length}`);
    
    for (const member of newMembers) {
      console.log(`\n👤 Processing ${member.name} (${member.email})...`);
      
      // Find user in auth.users
      const authUser = authUsers.users.find(u => u.email?.toLowerCase() === member.email.toLowerCase());
      
      if (!authUser) {
        console.log(`   ❌ User ${member.email} not found in auth.users`);
        console.log(`   💡 User needs to sign up first before being added to workspace`);
        continue;
      }
      
      console.log(`   ✅ Found auth user: ${authUser.id}`);
      
      // Check if already a member
      const { data: existingMembership } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', chillmineWorkspace.id)
        .eq('user_id', authUser.id)
        .single();
      
      if (existingMembership) {
        console.log(`   ⏭️ Already member of ChillMine Workspace (${existingMembership.role})`);
      } else {
        // Add workspace membership
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: chillmineWorkspace.id,
            user_id: authUser.id,
            role: member.role,
            joined_at: new Date().toISOString()
          });
        
        if (membershipError) {
          console.log(`   ❌ Failed to add to ChillMine Workspace: ${membershipError.message}`);
        } else {
          console.log(`   ✅ Added as ${member.role} to ChillMine Workspace`);
        }
      }
      
      // Check for LinkedIn account association potential
      console.log(`   🔍 Checking for LinkedIn account matches...`);
      
      try {
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
          
          // Look for exact name matches
          const exactMatches = linkedInAccounts.filter(acc => 
            acc.name?.toLowerCase() === member.linkedinAccount.toLowerCase()
          );
          
          if (exactMatches.length > 0) {
            console.log(`   📱 Found exact LinkedIn account match: ${exactMatches[0].name}`);
            console.log(`      - Unipile ID: ${exactMatches[0].id}`);
            console.log(`      - Status: ${exactMatches[0].sources?.map(s => s.status).join(', ')}`);
            
            // Check if already associated
            const { data: existingAssociation } = await supabase
              .from('user_unipile_accounts')
              .select('*')
              .eq('user_id', authUser.id)
              .eq('unipile_account_id', exactMatches[0].id)
              .single();
            
            if (existingAssociation) {
              console.log(`      ✅ LinkedIn account already associated`);
            } else {
              // Create the association
              const { error: assocError } = await supabase
                .from('user_unipile_accounts')
                .insert({
                  user_id: authUser.id,
                  unipile_account_id: exactMatches[0].id,
                  platform: 'LINKEDIN',
                  account_name: exactMatches[0].name,
                  account_email: member.email, // Manual mapping
                  linkedin_public_identifier: null,
                  linkedin_profile_url: null,
                  connection_status: exactMatches[0].sources?.some(s => s.status === 'OK') ? 'active' : 'needs_credentials',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (assocError) {
                console.log(`      ❌ Failed to associate LinkedIn account: ${assocError.message}`);
              } else {
                console.log(`      ✅ Successfully associated LinkedIn account!`);
              }
            }
          } else {
            console.log(`   📱 No exact LinkedIn account matches found for ${member.name}`);
            
            // Show similar matches for manual review
            const similarMatches = linkedInAccounts.filter(acc => {
              const accountName = acc.name?.toLowerCase() || '';
              const nameWords = member.name.toLowerCase().split(' ');
              return nameWords.some(word => accountName.includes(word));
            });
            
            if (similarMatches.length > 0) {
              console.log(`      💡 Similar names found (manual review needed):`);
              similarMatches.forEach(match => {
                console.log(`         - ${match.name} (ID: ${match.id})`);
              });
            }
          }
        }
      } catch (unipileError) {
        console.log(`   ⚠️ Could not check Unipile accounts: ${unipileError.message}`);
      }
    }
    
    // Final status of ChillMine workspace
    console.log('\n📊 Final ChillMine Workspace membership status:');
    const { data: finalMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', chillmineWorkspace.id);
    
    console.log(`✅ Total members: ${finalMemberships?.length || 0}`);
    
    if (finalMemberships && finalMemberships.length > 0) {
      for (const membership of finalMemberships) {
        // Get user email
        const user = authUsers.users.find(u => u.id === membership.user_id);
        const joinedDate = new Date(membership.joined_at).toLocaleDateString();
        
        console.log(`   - ${user?.email || 'Unknown'} (${membership.role}) - joined: ${joinedDate}`);
      }
    }
    
    // Show LinkedIn associations for ChillMine members
    console.log('\n🔗 LinkedIn associations for ChillMine members:');
    const { data: linkedinAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*');
    
    const chillmineMemberIds = finalMemberships?.map(m => m.user_id) || [];
    const chillmineLinkedInAssocs = linkedinAssocs?.filter(assoc => 
      chillmineMemberIds.includes(assoc.user_id)
    ) || [];
    
    console.log(`📱 Total LinkedIn associations: ${chillmineLinkedInAssocs.length}`);
    chillmineLinkedInAssocs.forEach(assoc => {
      const user = authUsers.users.find(u => u.id === assoc.user_id);
      console.log(`   - ${user?.email || 'Unknown'} → ${assoc.account_name} (${assoc.connection_status})`);
    });
    
    console.log('\n✅ ChillMine workspace member addition complete!');
    
  } catch (error) {
    console.error('❌ Failed to add ChillMine members:', error);
  }
}

addChillMineMembers();