#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 3cubed campaign ID
const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Checking 3cubed campaign...\n');

const { data: campaign } = await supabase
  .from('campaigns')
  .select('name, status, workspace_id')
  .eq('id', campaignId)
  .single();

console.log(`Campaign: ${campaign?.name || 'Not found'}`);
console.log(`Status: ${campaign?.status}\n`);

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, status, first_name, last_name, linkedin_url')
  .eq('campaign_id', campaignId);

console.log(`📊 Total prospects: ${prospects?.length || 0}\n`);

if (prospects && prospects.length > 0) {
  const statusCounts = prospects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  const readyToMessage = prospects.filter(p =>
    ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
    p.linkedin_url
  );

  console.log(`\n✅ Ready to message: ${readyToMessage.length}`);
  
  if (readyToMessage.length > 0) {
    console.log('\nWill be messaged automatically by cron (every 2 minutes)');
  } else {
    console.log('\n⚠️ No prospects ready to message');
    console.log('   Add prospects to this campaign to start messaging');
  }
}
