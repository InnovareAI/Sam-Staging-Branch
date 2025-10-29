#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Investigating Blue Label Labs Workspace\n');

// Find Blue Label Labs workspace
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', '014509ba-226e-43ee-ba58-ab5f20d2ed08')
  .single();

if (!workspace) {
  console.log('❌ Blue Label Labs workspace not found');
  process.exit(1);
}

console.log(`📁 Workspace: ${workspace.name}`);
console.log(`   ID: ${workspace.id}`);
console.log(`   Created: ${workspace.created_at}`);

// Check workspace members
const { data: members } = await supabase
  .from('workspace_members')
  .select('role, user_id, users(email, raw_user_meta_data)')
  .eq('workspace_id', workspace.id);

console.log(`\n👥 Workspace Members: ${members?.length || 0}`);
members?.forEach(m => {
  const userName = m.users?.raw_user_meta_data?.full_name || m.users?.email || 'Unknown';
  console.log(`   - ${userName}`);
  console.log(`     Email: ${m.users?.email || 'N/A'}`);
  console.log(`     Role: ${m.role}`);
});

// Check LinkedIn accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspace.id);

const linkedinAccounts = accounts?.filter(a => a.unipile_account_id);
console.log(`\n🔗 LinkedIn Accounts: ${linkedinAccounts?.length || 0}`);
linkedinAccounts?.forEach(acc => {
  console.log(`   - Unipile ID: ${acc.unipile_account_id}`);
  console.log(`     Status: ${acc.status || 'active'}`);
  console.log(`     Email: ${acc.email || 'N/A'}`);
});

// Check campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', workspace.id)
  .order('created_at', { ascending: false });

console.log(`\n📢 Campaigns: ${campaigns?.length || 0}`);

if (campaigns && campaigns.length > 0) {
  for (const campaign of campaigns) {
    console.log(`\n   Campaign: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Created: ${campaign.created_at}`);
    
    // Check prospects for this campaign
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('status, first_name, last_name, created_at')
      .eq('campaign_id', campaign.id);
    
    if (prospectsError) {
      console.log(`   ❌ Error fetching prospects: ${prospectsError.message}`);
      continue;
    }
    
    console.log(`   Prospects: ${prospects?.length || 0}`);
    
    if (prospects && prospects.length > 0) {
      const statusCounts = {};
      prospects.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     - ${status}: ${count}`);
      });
      
      // Show recent prospects
      const recent = prospects.slice(0, 5);
      console.log(`   Recent prospects:`);
      recent.forEach(p => {
        console.log(`     - ${p.first_name} ${p.last_name} (${p.status})`);
      });
    }
  }
} else {
  console.log('   No campaigns found\n');
}

// Check workspace_prospects (CRM prospects)
const { data: workspaceProspects, error: wpError } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, email, created_at, status')
  .eq('workspace_id', workspace.id)
  .order('created_at', { ascending: false })
  .limit(50);

console.log(`\n📊 Workspace Prospects (CRM): ${workspaceProspects?.length || 0}`);
if (wpError) {
  console.log(`   ❌ Error: ${wpError.message}`);
} else if (workspaceProspects && workspaceProspects.length > 0) {
  console.log(`   Total prospects in CRM: ${workspaceProspects.length}`);
  console.log(`\n   Recent 10 prospects:`);
  workspaceProspects.slice(0, 10).forEach(p => {
    console.log(`     - ${p.first_name || 'N/A'} ${p.last_name || 'N/A'} (${p.email || 'no email'})`);
    console.log(`       Status: ${p.status || 'N/A'}, Created: ${p.created_at}`);
  });
}

// Check for deleted prospects (if there's an audit log)
const { data: deletedCheck, count: totalProspects } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspace.id);

console.log(`\n📈 Total Prospects Count: ${totalProspects || 0}`);

// Check prospect_approval_data
const { data: approvalData, count: approvalCount } = await supabase
  .from('prospect_approval_data')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspace.id);

console.log(`📋 Prospect Approval Data Count: ${approvalCount || 0}`);
