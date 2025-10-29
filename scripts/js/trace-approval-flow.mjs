#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Tracing approval flow for recent prospects...\n');

// Check latest approval session
const { data: session } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (!session) {
  console.log('❌ No approval session found');
  process.exit(0);
}

console.log(`📊 Latest Approval Session:`);
console.log(`   Campaign: ${session.campaign_name}`);
console.log(`   ID: ${session.id}`);
console.log(`   Status: ${session.status}`);
console.log(`   Total prospects: ${session.total_prospects}`);
console.log(`   Created: ${session.created_at}\n`);

// Check raw_prospects_data in session
console.log(`📝 Raw prospects in session: ${session.raw_prospects_data?.length || 0}`);

if (session.raw_prospects_data && session.raw_prospects_data.length > 0) {
  console.log('\n✅ Sample from raw_prospects_data:');
  const sample = session.raw_prospects_data[0];
  console.log(`   Name: ${sample.name || sample.first_name + ' ' + sample.last_name}`);
  console.log(`   LinkedIn: ${sample.linkedin_url || sample.linkedin_profile_url}`);
  console.log(`   Has ID: ${!!sample.id ? 'YES ✅' : 'NO ❌'}`);
}

// Check prospect_approval_data table
const { data: approvalData, count } = await supabase
  .from('prospect_approval_data')
  .select('*', { count: 'exact' })
  .eq('session_id', session.id);

console.log(`\n📊 prospect_approval_data entries: ${count || 0}`);

if (count === 0) {
  console.log('\n❌ PROBLEM: No entries in prospect_approval_data!');
  console.log('   Prospects are NOT being saved when approved.');
  console.log('   They only exist in session.raw_prospects_data (JSONB field).');
  console.log('\n🔧 FIX NEEDED: DataCollectionHub must save to prospect_approval_data when user approves.');
} else {
  console.log('\n✅ Approved prospects found:');
  approvalData.slice(0, 3).forEach(p => {
    console.log(`   - ${p.name} (ID: ${p.id.substring(0, 8)}...)`);
  });
}

// Check if they made it to any campaign
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at')
  .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
  .order('created_at', { ascending: false })
  .limit(3);

console.log(`\n📊 Recent campaigns (last 10 min): ${campaigns?.length || 0}`);

if (campaigns && campaigns.length > 0) {
  for (const campaign of campaigns) {
    const { count: prospectCount } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
    
    console.log(`   - ${campaign.name}: ${prospectCount || 0} prospects`);
  }
}
