#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 CHECKING LAST EXECUTION ATTEMPT\n');

const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name')
  .ilike('name', '%test 9%')
  .single();

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

console.log(`Campaign: ${campaign.name}`);
console.log(`Prospects: ${prospects.length}\n`);

prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   LinkedIn URL: ${p.linkedin_url}`);
  console.log(`   Last contacted: ${p.contacted_at || 'Never'}`);
  console.log(`   Personalization data:`, p.personalization_data);
  console.log();
});

// Check for error messages in personalization_data
const failedProspects = prospects.filter(p => 
  p.personalization_data?.error || 
  p.status === 'failed' ||
  p.status === 'error'
);

if (failedProspects.length > 0) {
  console.log('\n❌ FAILED PROSPECTS:\n');
  failedProspects.forEach(p => {
    console.log(`${p.first_name} ${p.last_name}:`);
    console.log(`   Error: ${p.personalization_data?.error || 'Unknown'}`);
    console.log();
  });
}
