#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 FINDING RONY CHATTERJEE WORKSPACE');
console.log('='.repeat(70));

// Find Rony's workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%rony%');

if (workspaces?.length > 0) {
  for (const ws of workspaces) {
    console.log(`\nWorkspace: ${ws.name}`);
    console.log(`ID: ${ws.id}`);
    
    // Get campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, campaign_type, created_at')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false });
    
    console.log(`\nCampaigns: ${campaigns?.length || 0}`);
    for (const c of campaigns || []) {
      // Get prospect stats
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status')
        .eq('campaign_id', c.id);
      
      const stats = {};
      for (const p of prospects || []) {
        stats[p.status] = (stats[p.status] || 0) + 1;
      }
      
      console.log(`\n- ${c.name} | ${c.status} | ${c.campaign_type}`);
      console.log(`  Prospects: ${prospects?.length || 0}`);
      console.log(`  Status breakdown:`, stats);
    }
    
    // Check workspace accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('account_type, account_name, connection_status')
      .eq('workspace_id', ws.id);
    
    console.log(`\nAccounts: ${accounts?.length || 0}`);
    for (const a of accounts || []) {
      console.log(`  - ${a.account_type}: ${a.account_name} (${a.connection_status})`);
    }
  }
} else {
  // Try searching by member name
  console.log('No workspace named Rony, searching members...');
  
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name)')
    .or('user_id.in.(select id from auth.users where email ilike %rony%)');
  
  // Alternative: search LinkedIn accounts
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, account_name, workspaces(id, name)')
    .eq('account_type', 'linkedin')
    .ilike('account_name', '%rony%');
  
  console.log('\nLinkedIn accounts with "Rony":');
  for (const a of linkedinAccounts || []) {
    console.log(`  - ${a.account_name} → Workspace: ${a.workspaces?.name} (${a.workspace_id})`);
  }
}

console.log('\n' + '='.repeat(70));
