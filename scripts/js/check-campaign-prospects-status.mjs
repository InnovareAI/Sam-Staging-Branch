#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking campaign prospect statuses\n');

// Get all campaigns updated in last hour
const { data: recentCampaigns } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .order('updated_at', { ascending: false })
  .limit(3);

console.log('Recent Campaigns:');
recentCampaigns?.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.name} (${c.id.substring(0, 8)})`);
});

if (recentCampaigns && recentCampaigns.length > 0) {
  const latestCampaign = recentCampaigns[0];
  console.log(`\n📊 Checking: ${latestCampaign.name}\n`);
  
  // Get prospect counts by status
  const { data: allProspects } = await supabase
    .from('campaign_prospects')
    .select('status, first_name, last_name, linkedin_url')
    .eq('campaign_id', latestCampaign.id);
  
  console.log(`Total prospects: ${allProspects?.length || 0}`);
  
  // Count by status
  const statusCounts = {};
  allProspects?.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  
  console.log('\nStatus breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  // Show sample prospects
  console.log('\nSample prospects:');
  allProspects?.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name || '(empty)'} ${p.last_name || '(empty)'} [${p.status}]`);
    console.log(`      LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
  });
  
  // Check which statuses are eligible for messaging
  const ready = allProspects?.filter(p => 
    ['pending', 'approved', 'ready_to_message'].includes(p.status)
  );
  
  console.log(`\n✅ Ready for messaging: ${ready?.length || 0}`);
  
  if (ready && ready.length === 0) {
    console.log('\n⚠️  NO PROSPECTS READY - This is why campaign shows "No prospects ready"');
    console.log('    Possible reasons:');
    console.log('    1. All prospects already contacted (status: connection_requested)');
    console.log('    2. Prospects in wrong status');
    console.log('    3. No prospects uploaded to this campaign');
  }
}
