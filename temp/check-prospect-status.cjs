#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspectStatus() {
  console.log('🔍 Checking campaign prospects status...\n');

  // Get recent campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent campaigns:');
  campaigns?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${c.id})`);
  });
  console.log('');

  // Use most recent campaign
  const campaign = campaigns?.[0];

  if (!campaign) {
    console.error('❌ Campaign not found');
    return;
  }

  console.log(`📊 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}\n`);

  // Get all prospects in the campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaign.id);

  console.log(`📈 Total Prospects: ${prospects?.length || 0}\n`);

  // Group by status
  const statusCounts = {};
  prospects?.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('📊 Prospects by Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  console.log('');

  // Check which statuses are eligible for messaging
  const eligibleStatuses = ['pending', 'approved', 'ready_to_message', 'follow_up_due'];
  const eligible = prospects?.filter(p => eligibleStatuses.includes(p.status));

  console.log(`✅ Eligible for messaging: ${eligible?.length || 0}`);

  if (eligible && eligible.length > 0) {
    console.log('\nEligible prospects:');
    eligible.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`);
      console.log(`     LinkedIn: ${p.linkedin_url || 'MISSING'}`);
    });
  } else {
    console.log('\n⚠️  No prospects in eligible statuses:', eligibleStatuses.join(', '));
  }

  // Check if prospects are missing LinkedIn URLs
  const missingUrls = prospects?.filter(p => !p.linkedin_url);
  if (missingUrls && missingUrls.length > 0) {
    console.log(`\n❌ ${missingUrls.length} prospects missing LinkedIn URLs`);
  }

  // Check who imported these prospects
  console.log('\n🔍 Checking prospect import source...');
  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('session_id, prospect_approval_sessions(user_id)')
    .limit(1)
    .single();

  if (approvalData?.prospect_approval_sessions?.user_id) {
    const { data: importUser } = await supabase.auth.admin.getUserById(
      approvalData.prospect_approval_sessions.user_id
    );
    console.log(`   Imported by: ${importUser.user?.email || 'Unknown'}`);
  }
}

checkProspectStatus().catch(console.error);
