#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 FULL FLOW DEBUG\n');

// Get workspace
const { data: campaign } = await supabase
  .from('campaigns')
  .select('workspace_id, id, name, created_by')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`📊 Latest campaign: ${campaign.name}`);
console.log(`   Workspace: ${campaign.workspace_id}`);
console.log(`   Created by: ${campaign.created_by}\n`);

// Check prospect_approval_sessions
const { data: sessions } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`📋 Approval Sessions: ${sessions?.length || 0}`);
if (sessions && sessions.length > 0) {
  sessions.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.campaign_name} - ${s.session_status}`);
    console.log(`      Total: ${s.total_prospects}, Approved: ${s.approved_count}`);
    console.log(`      Session ID: ${s.id}\n`);
  });
}

// Check prospect_approval_data for ALL statuses
const { data: allData } = await supabase
  .from('prospect_approval_data')
  .select('approval_status, name, contact, linkedin_url, prospect_id, session_id')
  .eq('workspace_id', campaign.workspace_id)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\n📊 Prospect Approval Data (last 10):`);
if (allData && allData.length > 0) {
  const statusCounts = {};
  allData.forEach(p => {
    statusCounts[p.approval_status] = (statusCounts[p.approval_status] || 0) + 1;
  });

  console.log(`   Total records: ${allData.length}`);
  console.log(`   By status:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`      ${status}: ${count}`);
  });

  console.log(`\n   Details:`);
  allData.forEach((p, i) => {
    const hasContactLinkedIn = p.contact?.linkedin_url;
    const hasDirectLinkedIn = p.linkedin_url;
    console.log(`   ${i + 1}. ${p.name} (${p.approval_status})`);
    console.log(`      prospect_id: ${p.prospect_id}`);
    console.log(`      session_id: ${p.session_id}`);
    console.log(`      contact.linkedin_url: ${hasContactLinkedIn ? '✅' : '❌'}`);
    console.log(`      linkedin_url: ${hasDirectLinkedIn ? '✅' : '❌'}`);
    if (hasContactLinkedIn) console.log(`         ${p.contact.linkedin_url}`);
    if (hasDirectLinkedIn) console.log(`         ${p.linkedin_url}`);
    console.log();
  });
} else {
  console.log('   ❌ No data found\n');
}

// Check campaign_prospects
const { data: campProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, status')
  .eq('campaign_id', campaign.id);

console.log(`\n📊 Campaign Prospects: ${campProspects?.length || 0}`);
if (campProspects && campProspects.length > 0) {
  campProspects.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} (${p.status})`);
    console.log(`      LinkedIn: ${p.linkedin_url ? '✅ ' + p.linkedin_url : '❌ MISSING'}\n`);
  });
} else {
  console.log('   ❌ No prospects in campaign\n');
}

console.log('\n💡 Next Steps:');
if (!allData || allData.length === 0) {
  console.log('   1. ⚠️  No data in prospect_approval_data - SAM needs to extract prospects first');
  console.log('   2. Ask SAM to find prospects or manually upload via CSV');
} else if (allData.filter(p => p.approval_status === 'approved').length === 0) {
  console.log('   1. ⚠️  No approved prospects - need to approve some via Data Approval UI');
} else if (!campProspects || campProspects.length === 0) {
  console.log('   1. ⚠️  Approved prospects exist but not added to campaign');
  console.log('   2. Need to call: POST /api/campaigns/add-approved-prospects');
  console.log('   3. Check frontend is calling this API when creating campaign');
}
