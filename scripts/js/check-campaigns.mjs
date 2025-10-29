#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log('🎯 YOUR CAMPAIGNS\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .order('created_at', { ascending: false })
  .limit(10);

if (!campaigns || campaigns.length === 0) {
  console.log('❌ No campaigns found');
  process.exit(0);
}

console.log(`Found ${campaigns.length} campaigns:\n`);

for (const campaign of campaigns) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);
  
  const prospectCount = prospects?.length || 0;
  const byStatus = {};
  
  if (prospects) {
    prospects.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });
  }
  
  console.log(`📊 ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Prospects: ${prospectCount}`);
  
  if (prospectCount > 0) {
    console.log(`   Breakdown:`, byStatus);
    console.log(`   Sample prospects:`);
    prospects.slice(0, 3).forEach(p => {
      console.log(`     - ${p.first_name} ${p.last_name} (${p.status})`);
      console.log(`       LinkedIn: ${p.linkedin_url}`);
    });
  }
  
  console.log();
}

// Find campaign with most prospects ready to execute
const activeCampaign = campaigns.find(c => c.status === 'active');
if (activeCampaign) {
  const { data: ready } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', activeCampaign.id)
    .in('status', ['approved', 'pending', 'ready_to_message']);
  
  console.log(`\n🚀 READY TO EXECUTE:`);
  console.log(`Campaign: ${activeCampaign.name}`);
  console.log(`Prospects ready: ${ready?.length || 0}`);
}
