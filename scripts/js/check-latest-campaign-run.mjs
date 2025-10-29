#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking latest campaign execution\n');

// Get all campaigns ordered by updated_at
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, updated_at')
  .order('updated_at', { ascending: false })
  .limit(5);

console.log('📋 Recent Campaigns:');
campaigns?.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.name} (${c.status}) - ${c.updated_at}`);
});

// Get prospects from the most recent campaign
if (campaigns && campaigns.length > 0) {
  const latestCampaign = campaigns[0];
  console.log(`\n🎯 Latest Campaign: ${latestCampaign.name}\n`);
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', latestCampaign.id)
    .order('updated_at', { ascending: false })
    .limit(3);
  
  console.log('Recent Prospects:');
  prospects?.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Company: ${p.company_name || 'NULL'}`);
    console.log(`   LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
    console.log(`   Error: ${p.error_message || 'none'}`);
    
    if (p.personalization_data) {
      console.log(`   Personalization data:`, JSON.stringify(p.personalization_data, null, 2));
    }
  });
}
