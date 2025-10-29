#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the specific campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', '8ba7f767-42a9-4c44-808a-b244e9afdd32')
  .single();

console.log('Campaign:', campaign.name);
console.log('Connection Message:', campaign.connection_message?.substring(0, 150));
console.log();

// Get prospects with details
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id)
  .eq('status', 'pending')
  .limit(3);

console.log('Sample pending prospects:');
prospects.forEach((p, i) => {
  console.log(`\n${i + 1}. LinkedIn: ${p.linkedin_url}`);
  console.log(`   First Name: "${p.first_name || ''}"`);
  console.log(`   Last Name: "${p.last_name || ''}"`);
  console.log(`   Company: "${p.company_name || ''}"`);
  console.log(`   Personalization Data:`, JSON.stringify(p.personalization_data, null, 2));
});
