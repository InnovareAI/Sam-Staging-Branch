#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Latest campaign
const campaignId = 'bab75edd-7bf2-4d8e-a638-dfbe42f1b57b'; // 20251029-IAI-test 2

console.log('🔍 Checking prospects with missing names\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status')
  .eq('campaign_id', campaignId)
  .or('first_name.is.null,last_name.is.null');

console.log(`Found ${prospects?.length || 0} prospects with missing names:\n`);

prospects?.forEach((p, i) => {
  console.log(`${i + 1}. ID: ${p.id.substring(0, 8)}`);
  console.log(`   Name: "${p.first_name || 'NULL'}" "${p.last_name || 'NULL'}"`);
  console.log(`   Company: ${p.company_name || 'NULL'}`);
  console.log(`   LinkedIn: ${p.linkedin_url || 'NULL'}`);
  console.log(`   Status: ${p.status}\n`);
});

console.log('\n💡 These prospects need enrichment from LinkedIn profiles');
console.log('The auto-enrichment should happen automatically when deployment completes.');
