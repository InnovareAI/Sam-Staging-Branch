/**
 * Analyze Workspace Structure for Managed Accounts
 * ===============================================
 * Understand current setup and design workspace switcher
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeWorkspaceStructure() {
  console.log('🔍 Analyzing workspace structure for managed account strategy...');
  
  try {
    // Get workspace memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role');
    
    // Get workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*');
    
    // Get auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    // Get LinkedIn associations
    const { data: linkedinAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*');
    
    console.log('\n📊 Current workspace structure:');
    
    for (const workspace of workspaces || []) {
      const wsMembers = memberships?.filter(m => m.workspace_id === workspace.id) || [];
      console.log(`\n🏢 ${workspace.name} (${workspace.id})`);
      console.log(`   👑 Owner: ${workspace.owner_id}`);
      console.log(`   👥 Members: ${wsMembers.length}`);
      
      wsMembers.forEach(member => {
        const user = authUsers.users.find(u => u.id === member.user_id);
        const userLinkedIn = linkedinAssocs?.filter(la => la.user_id === member.user_id) || [];
        console.log(`      - ${user?.email || 'Unknown'} (${member.role}) - LinkedIn: ${userLinkedIn.length}`);
      });
    }
    
    // Analyze InnovareAI vs Client separation
    console.log('\n🏢 INNOVAREAI vs CLIENT workspace analysis:');
    
    const innovareWorkspace = workspaces?.find(w => w.name === 'InnovareAI Workspace');
    if (innovareWorkspace) {
      const innovareMembers = memberships?.filter(m => m.workspace_id === innovareWorkspace.id) || [];
      console.log(`\n🏢 InnovareAI Team (${innovareMembers.length} members):`);
      
      for (const member of innovareMembers) {
        const user = authUsers.users.find(u => u.id === member.user_id);
        const userLinkedIn = linkedinAssocs?.filter(la => la.user_id === member.user_id) || [];
        
        // Check which other workspaces this user is in
        const otherMemberships = memberships?.filter(m => 
          m.user_id === member.user_id && m.workspace_id !== innovareWorkspace.id
        ) || [];
        
        console.log(`   - ${user?.email || 'Unknown'} (${member.role})`);
        console.log(`     LinkedIn accounts: ${userLinkedIn.length}`);
        console.log(`     Also member of: ${otherMemberships.length} other workspaces`);
        
        if (otherMemberships.length > 0) {
          otherMemberships.forEach(om => {
            const otherWs = workspaces?.find(w => w.id === om.workspace_id);
            console.log(`       → ${otherWs?.name || 'Unknown'} (${om.role})`);
          });
        }
      }
    }
    
    const clientWorkspaces = workspaces?.filter(w => w.name !== 'InnovareAI Workspace') || [];
    console.log(`\n👥 Client Workspaces (${clientWorkspaces.length}):`);
    
    for (const workspace of clientWorkspaces) {
      const wsMembers = memberships?.filter(m => m.workspace_id === workspace.id) || [];
      console.log(`\n   🏢 ${workspace.name} (${wsMembers.length} members):`);
      
      wsMembers.forEach(member => {
        const user = authUsers.users.find(u => u.id === member.user_id);
        const isInnovareTeam = user?.email?.includes('@innovareai.com');
        const userLinkedIn = linkedinAssocs?.filter(la => la.user_id === member.user_id) || [];
        
        console.log(`      - ${user?.email || 'Unknown'} (${member.role}) ${isInnovareTeam ? '- MANAGER' : '- CLIENT'} - LinkedIn: ${userLinkedIn.length}`);
      });
    }
    
    // Analyze LinkedIn account distribution
    console.log('\n🔗 LinkedIn Account Analysis:');
    
    // Fetch Unipile accounts
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
      
      console.log(`📱 Total LinkedIn accounts in Unipile: ${linkedInAccounts.length}`);
      console.log(`🔗 Associated to users: ${linkedinAssocs?.length || 0}`);
      console.log(`❓ Unassociated: ${linkedInAccounts.length - (linkedinAssocs?.length || 0)}`);
      
      console.log('\n📋 LinkedIn Account Details:');
      linkedInAccounts.forEach(acc => {
        const association = linkedinAssocs?.find(la => la.unipile_account_id === acc.id);
        const user = association ? authUsers.users.find(u => u.id === association.user_id) : null;
        const status = acc.sources?.map(s => s.status).join(', ') || 'Unknown';
        
        console.log(`   - ${acc.name} (${acc.id})`);
        console.log(`     Status: ${status}`);
        console.log(`     Associated to: ${user?.email || 'UNASSOCIATED'}`);
        
        if (user) {
          const userWorkspaces = memberships?.filter(m => m.user_id === user.id) || [];
          console.log(`     User's workspaces: ${userWorkspaces.length}`);
          userWorkspaces.forEach(uw => {
            const ws = workspaces?.find(w => w.id === uw.workspace_id);
            console.log(`       → ${ws?.name || 'Unknown'} (${uw.role})`);
          });
        }
      });
    }
    
    console.log('\n🎯 MANAGED ACCOUNT STRATEGY RECOMMENDATIONS:');
    console.log('');
    console.log('1. 🏢 WORKSPACE STRUCTURE:');
    console.log('   - InnovareAI Team manages LinkedIn accounts for all client workspaces');
    console.log('   - tl@innovareai.com has admin access to ALL workspaces');
    console.log('   - cl@innovareai.com has admin access to InnovareAI + ChillMine');
    console.log('');
    console.log('2. 🔐 PRIVACY & SECURITY:');
    console.log('   - LinkedIn accounts should be "shared resources" for InnovareAI team');
    console.log('   - Client users should NOT see LinkedIn credentials or account details');
    console.log('   - Campaign data can be workspace-isolated while sharing LinkedIn accounts');
    console.log('');
    console.log('3. 🔄 WORKSPACE SWITCHER DESIGN:');
    console.log('   - InnovareAI team members should see workspace switcher');
    console.log('   - Client users should only see their own workspace');
    console.log('   - LinkedIn accounts should be "pooled" and managed centrally');
    console.log('');
    console.log('4. 🚀 IMPLEMENTATION APPROACH:');
    console.log('   - Add "workspace_context" to campaign operations');
    console.log('   - LinkedIn accounts remain "global" to InnovareAI team');
    console.log('   - Campaign results/data filtered by workspace');
    console.log('   - UI shows different views for managers vs clients');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

analyzeWorkspaceStructure();