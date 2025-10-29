#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking personalization_data in recent campaigns\n');

// Get recent campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .order('updated_at', { ascending: false })
  .limit(5);

console.log('Recent campaigns:');
campaigns?.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.name} (${c.id.substring(0, 8)})`);
});

for (const campaign of campaigns || []) {
  console.log(`\n📊 Campaign: ${campaign.name}\n`);
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, personalization_data')
    .eq('campaign_id', campaign.id)
    .limit(3);
  
  if (!prospects || prospects.length === 0) {
    console.log('   No prospects found\n');
    continue;
  }
  
  console.log(`   Found ${prospects.length} prospects:\n`);
  
  prospects.forEach((p, i) => {
    console.log(`   Prospect ${i + 1}: ${p.first_name} ${p.last_name} [${p.status}]`);
    console.log(`   personalization_data:`, JSON.stringify(p.personalization_data, null, 2));
    console.log('');
  });
}
