/**
 * Add New Members to InnovareAI Workspace
 * ======================================
 * Add Irish Maguad, Michelle Gestuveo, and Charissa Saniel to InnovareAI workspace
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addInnovareAIMembers() {
  console.log('👥 Adding new members to InnovareAI workspace...');
  
  try {
    // Get InnovareAI workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*')
      .eq('name', 'InnovareAI Workspace');
    
    const innovareWorkspace = workspaces?.[0];
    
    if (!innovareWorkspace) {
      console.log('❌ InnovareAI Workspace not found');
      return;
    }
    
    console.log(`✅ Found InnovareAI Workspace: ${innovareWorkspace.id}`);
    
    // Define new members to add
    const newMembers = [
      {
        email: 'im@innovareai.com',
        name: 'Irish Maguad',
        role: 'admin'
      },
      {
        email: 'mg@innovareai.com', 
        name: 'Michelle Gestuveo',
        role: 'admin'
      },
      {
        email: 'cs@innovareai.com', // Fixed typo from "Cs@innvoareai.com"
        name: 'Charissa Saniel',
        role: 'admin'
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
        .eq('workspace_id', innovareWorkspace.id)
        .eq('user_id', authUser.id)
        .single();
      
      if (existingMembership) {
        console.log(`   ⏭️ Already member of InnovareAI Workspace (${existingMembership.role})`);
        continue;
      }
      
      // Add workspace membership
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: innovareWorkspace.id,
          user_id: authUser.id,
          role: member.role,
          joined_at: new Date().toISOString()
        });
      
      if (membershipError) {
        console.log(`   ❌ Failed to add to InnovareAI Workspace: ${membershipError.message}`);
      } else {
        console.log(`   ✅ Added as ${member.role} to InnovareAI Workspace`);
      }
      
      // Check for potential LinkedIn account matches
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
          
          // Check for name matches (since emails aren't in Unipile accounts)
          const nameMatches = linkedInAccounts.filter(acc => {
            const accountName = acc.name?.toLowerCase() || '';
            const userName = member.name.toLowerCase();
            
            // Check if any part of the name matches
            const nameWords = userName.split(' ');
            return nameWords.some(word => accountName.includes(word.toLowerCase()));
          });
          
          if (nameMatches.length > 0) {
            console.log(`   📱 Found ${nameMatches.length} potential LinkedIn account matches:`);
            nameMatches.forEach(match => {
              console.log(`      - ${match.name} (ID: ${match.id}) - Status: ${match.sources?.map(s => s.status).join(', ')}`);
            });
            console.log(`   💡 Manual association may be needed if this is the correct LinkedIn account`);
          } else {
            console.log(`   📱 No LinkedIn account matches found for ${member.name}`);
          }
        }
      } catch (unipileError) {
        console.log(`   ⚠️ Could not check Unipile accounts: ${unipileError.message}`);
      }
    }
    
    // Final status of InnovareAI workspace
    console.log('\n📊 Final InnovareAI Workspace membership status:');
    const { data: finalMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', innovareWorkspace.id);
    
    console.log(`✅ Total members: ${finalMemberships?.length || 0}`);
    
    if (finalMemberships && finalMemberships.length > 0) {
      for (const membership of finalMemberships) {
        // Get user email
        const user = authUsers.users.find(u => u.id === membership.user_id);
        const joinedDate = new Date(membership.joined_at).toLocaleDateString();
        
        console.log(`   - ${user?.email || 'Unknown'} (${membership.role}) - joined: ${joinedDate}`);
      }
    }
    
    console.log('\n✅ InnovareAI workspace member addition complete!');
    
  } catch (error) {
    console.error('❌ Failed to add InnovareAI members:', error);
  }
}

addInnovareAIMembers();