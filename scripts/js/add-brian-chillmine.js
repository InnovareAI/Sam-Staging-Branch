/**
 * Add Brian Neirby to ChillMine Workspace
 * =====================================
 * Add Brian Neirby to ChillMine workspace
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addBrianToChillMine() {
  console.log('👤 Adding Brian Neirby to ChillMine workspace...');
  
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
    
    // Brian's information - need to determine his email
    const brianMember = {
      name: 'Brian Neirby',
      role: 'admin',
      // Common email patterns to check
      possibleEmails: [
        'brian@chillmine.io',
        'brian.neirby@chillmine.io', 
        'bneirby@chillmine.io',
        'b.neirby@chillmine.io'
      ]
    };
    
    // Get all auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    console.log(`📊 Total auth users: ${authUsers.users.length}`);
    
    console.log(`\n👤 Searching for Brian Neirby...`);
    
    // Try to find Brian by checking possible email patterns
    let brianUser = null;
    let brianEmail = null;
    
    for (const email of brianMember.possibleEmails) {
      const user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        brianUser = user;
        brianEmail = email;
        break;
      }
    }
    
    // Also check for partial name matches in existing users
    if (!brianUser) {
      const nameMatches = authUsers.users.filter(u => {
        const email = u.email?.toLowerCase() || '';
        return email.includes('brian') || email.includes('neirby');
      });
      
      if (nameMatches.length > 0) {
        console.log(`🔍 Found potential name matches:`);
        nameMatches.forEach(match => {
          console.log(`   - ${match.email} (ID: ${match.id})`);
        });
        
        // Use the first match if only one found
        if (nameMatches.length === 1) {
          brianUser = nameMatches[0];
          brianEmail = nameMatches[0].email;
          console.log(`   ✅ Using: ${brianEmail}`);
        }
      }
    }
    
    if (!brianUser) {
      console.log(`❌ Brian Neirby not found in auth.users`);
      console.log(`💡 Checked these email patterns:`);
      brianMember.possibleEmails.forEach(email => {
        console.log(`   - ${email}`);
      });
      console.log(`💡 Brian needs to sign up first or provide his correct email address`);
      return;
    }
    
    console.log(`✅ Found Brian: ${brianEmail} (${brianUser.id})`);
    
    // Check if already a member
    const { data: existingMembership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', chillmineWorkspace.id)
      .eq('user_id', brianUser.id)
      .single();
    
    if (existingMembership) {
      console.log(`⏭️ Brian is already a member of ChillMine Workspace (${existingMembership.role})`);
    } else {
      // Add workspace membership
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: chillmineWorkspace.id,
          user_id: brianUser.id,
          role: brianMember.role,
          joined_at: new Date().toISOString()
        });
      
      if (membershipError) {
        console.log(`❌ Failed to add Brian to ChillMine Workspace: ${membershipError.message}`);
      } else {
        console.log(`✅ Added Brian as ${brianMember.role} to ChillMine Workspace`);
      }
    }
    
    // Check for potential LinkedIn account matches
    console.log(`🔍 Checking for LinkedIn account matches for Brian Neirby...`);
    
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
        
        // Look for Brian-related matches
        const brianMatches = linkedInAccounts.filter(acc => {
          const accountName = acc.name?.toLowerCase() || '';
          return accountName.includes('brian') || accountName.includes('neirby');
        });
        
        if (brianMatches.length > 0) {
          console.log(`📱 Found ${brianMatches.length} potential LinkedIn matches:`);
          brianMatches.forEach(match => {
            console.log(`   - ${match.name} (ID: ${match.id}) - Status: ${match.sources?.map(s => s.status).join(', ')}`);
          });
          console.log(`💡 Manual association may be needed if one of these is Brian's LinkedIn account`);
        } else {
          console.log(`📱 No LinkedIn accounts found matching "Brian" or "Neirby"`);
          console.log(`💡 Brian may need to connect his LinkedIn account manually via /linkedin-integration`);
        }
      }
    } catch (unipileError) {
      console.log(`⚠️ Could not check Unipile accounts: ${unipileError.message}`);
    }
    
    // Show updated ChillMine workspace status
    console.log('\n📊 Updated ChillMine Workspace membership status:');
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
    
    console.log('\n✅ Brian Neirby addition to ChillMine workspace complete!');
    
  } catch (error) {
    console.error('❌ Failed to add Brian to ChillMine:', error);
  }
}

addBrianToChillMine();