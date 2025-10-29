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

console.log('🔍 FINDING ACTIVE CAMPAIGNS WITH PROSPECTS\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('status', 'active')
  .order('created_at', { ascending: false });

console.log(`Found ${campaigns?.length || 0} active campaigns\n`);

for (const campaign of campaigns || []) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);
  
  const ready = prospects?.filter(p => 
    ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
    p.linkedin_url &&
    !p.contacted_at
  ) || [];
  
  console.log(`📊 ${campaign.name}`);
  console.log(`   Total prospects: ${prospects?.length || 0}`);
  console.log(`   Ready to message: ${ready.length}`);
  
  if (ready.length > 0) {
    console.log(`   ✅ READY PROSPECTS:`);
    ready.slice(0, 3).forEach(p => {
      console.log(`      - ${p.first_name} ${p.last_name} (${p.status})`);
    });
  }
  
  console.log();
}

// Find the one you just tried to execute
console.log('\n🎯 LAST EXECUTED CAMPAIGN:');
const { data: lastCampaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .order('updated_at', { ascending: false })
  .limit(1)
  .single();

if (lastCampaign) {
  console.log(`Campaign: ${lastCampaign.name}`);
  console.log(`Updated: ${new Date(lastCampaign.updated_at).toLocaleString()}`);
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', lastCampaign.id);
  
  console.log(`\nProspects (${prospects?.length || 0}):`);
  prospects?.forEach(p => {
    console.log(`  ${p.status}: ${p.first_name} ${p.last_name}`);
    console.log(`     LinkedIn: ${p.linkedin_url || 'MISSING'}`);
    console.log(`     Contacted: ${p.contacted_at || 'Never'}`);
  });
}
