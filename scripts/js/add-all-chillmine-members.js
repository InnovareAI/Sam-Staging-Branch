/**
 * Add All ChillMine Members
 * ========================
 * Check and add all ChillMine members: Pete, Martin, Brian, Harry, and Nhena
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAllChillMineMembers() {
  console.log('👥 Checking and adding all ChillMine workspace members...');
  
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
    
    // Define all ChillMine members to add
    const chillmineMembers = [
      {
        email: 'pete@chillmine.io',
        name: 'Pete Noble',
        role: 'admin',
        linkedinAccount: 'Peter Noble'
      },
      {
        email: 'martin@chillmine.io', 
        name: 'Martin Schechtner',
        role: 'admin',
        linkedinAccount: 'Martin Schechtner'
      },
      {
        email: 'brian@chillmine.io',
        name: 'Brian Neirby',
        role: 'admin',
        linkedinAccount: null // Will check for matches
      },
      {
        email: 'harry@chillmine.io',
        name: 'Harry',
        role: 'admin',
        linkedinAccount: null // Will check for matches
      },
      {
        email: 'nhena@chillmine.io',
        name: 'Nhena',
        role: 'admin',
        linkedinAccount: null // Will check for matches
      }
    ];
    
    // Get all auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    console.log(`📊 Total auth users: ${authUsers.users.length}`);
    
    // Track who needs to sign up vs who can be added
    const needSignup = [];
    const canBeAdded = [];
    
    for (const member of chillmineMembers) {
      console.log(`\n👤 Checking ${member.name} (${member.email})...`);
      
      // Find user in auth.users
      const authUser = authUsers.users.find(u => u.email?.toLowerCase() === member.email.toLowerCase());
      
      if (!authUser) {
        console.log(`   ❌ Not found in auth.users - needs to sign up`);
        needSignup.push(member);
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
          canBeAdded.push({...member, authUser});
        }
      }
    }
    
    // Check LinkedIn accounts for all members
    console.log('\n🔍 Checking LinkedIn account associations...');
    
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
        
        console.log(`📱 Available LinkedIn accounts in Unipile: ${linkedInAccounts.length}`);
        linkedInAccounts.forEach(acc => {
          console.log(`   - ${acc.name} (ID: ${acc.id}) - Status: ${acc.sources?.map(s => s.status).join(', ')}`);
        });
        
        // Check for potential matches for members without known LinkedIn accounts
        const unknownLinkedInMembers = chillmineMembers.filter(m => !m.linkedinAccount);
        
        if (unknownLinkedInMembers.length > 0) {
          console.log(`\n🔍 Searching for LinkedIn matches for Brian, Harry, and Nhena...`);
          
          unknownLinkedInMembers.forEach(member => {
            const nameWords = member.name.toLowerCase().split(' ');
            const matches = linkedInAccounts.filter(acc => {
              const accountName = acc.name?.toLowerCase() || '';
              return nameWords.some(word => accountName.includes(word));
            });
            
            if (matches.length > 0) {
              console.log(`   📱 ${member.name} - Found ${matches.length} potential matches:`);
              matches.forEach(match => {
                console.log(`      - ${match.name} (ID: ${match.id})`);
              });
            } else {
              console.log(`   📱 ${member.name} - No obvious LinkedIn matches found`);
            }
          });
        }
        
      }
    } catch (unipileError) {
      console.log(`⚠️ Could not check Unipile accounts: ${unipileError.message}`);
    }
    
    // Final summary
    console.log('\n📊 ChillMine Workspace Member Summary:');
    
    const { data: finalMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', chillmineWorkspace.id);
    
    console.log(`✅ Current members: ${finalMemberships?.length || 0}`);
    
    if (finalMemberships && finalMemberships.length > 0) {
      for (const membership of finalMemberships) {
        const user = authUsers.users.find(u => u.id === membership.user_id);
        const joinedDate = new Date(membership.joined_at).toLocaleDateString();
        console.log(`   - ${user?.email || 'Unknown'} (${membership.role}) - joined: ${joinedDate}`);
      }
    }
    
    if (needSignup.length > 0) {
      console.log(`\n❌ Need to sign up first (${needSignup.length}):`);
      needSignup.forEach(member => {
        console.log(`   - ${member.name} (${member.email})`);
      });
    }
    
    if (canBeAdded.length > 0) {
      console.log(`\n✅ Successfully processed (${canBeAdded.length}):`);
      canBeAdded.forEach(member => {
        console.log(`   - ${member.name} (${member.email})`);
      });
    }
    
    console.log('\n✅ ChillMine workspace member check complete!');
    
  } catch (error) {
    console.error('❌ Failed to process ChillMine members:', error);
  }
}

addAllChillMineMembers();