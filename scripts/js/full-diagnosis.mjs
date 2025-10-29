#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 FULL SYSTEM DIAGNOSIS\n');
console.log('='.repeat(60));

// Get user
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log(`\n👤 User: ${user.email}`);
console.log(`   Workspace: ${user.current_workspace_id}\n`);

// Get ALL campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_by, created_at')
  .eq('workspace_id', user.current_workspace_id)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`📋 Last 10 Campaigns:\n`);
for (let i = 0; i < campaigns.length; i++) {
  const c = campaigns[i];
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', c.id);
  
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   Prospects: ${prospects?.length || 0}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\n`);
}

// Get LinkedIn account
const { data: linkedIn } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('user_id', user.id)
  .eq('account_type', 'linkedin')
  .single();

console.log(`🔗 LinkedIn: ${linkedIn ? '✅ Connected' : '❌ NOT CONNECTED'}`);
if (linkedIn) {
  console.log(`   Account: ${linkedIn.account_name}`);
  console.log(`   Unipile ID: ${linkedIn.unipile_account_id}\n`);
}

// Check approved prospects
const { data: approved } = await supabase
  .from('prospect_approval_data')
  .select('id')
  .eq('workspace_id', user.current_workspace_id)
  .eq('approval_status', 'approved');

console.log(`✅ Approved Prospects Available: ${approved?.length || 0}\n`);

// Check latest campaign in detail
const latest = campaigns[0];
const { data: latestProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', latest.id);

console.log('='.repeat(60));
console.log(`\n📊 LATEST CAMPAIGN DETAIL: ${latest.name}\n`);
console.log(`Total Prospects: ${latestProspects?.length || 0}`);

if (latestProspects && latestProspects.length > 0) {
  const withLinkedIn = latestProspects.filter(p => p.linkedin_url);
  const correctStatus = latestProspects.filter(p => ['pending', 'approved', 'ready_to_message'].includes(p.status));
  
  console.log(`With LinkedIn URL: ${withLinkedIn.length}`);
  console.log(`Correct Status: ${correctStatus.length}`);
  
  console.log(`\nProspect Details:`);
  latestProspects.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   LinkedIn: ${p.linkedin_url ? '✅' : '❌ MISSING'}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Owner: ${p.added_by_unipile_account || 'NULL'}`);
  });
} else {
  console.log('❌ NO PROSPECTS IN CAMPAIGN\n');
  console.log('💡 SOLUTION:');
  console.log('   1. Go to Data Approval');
  console.log('   2. Approve some prospects');
  console.log('   3. Click "Create Campaign"');
  console.log('   4. Prospects should auto-add\n');
}

console.log('='.repeat(60));
