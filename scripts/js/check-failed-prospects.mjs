#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Analyzing failed prospects...\n');

const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, personalization_data, error_message')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(5);

if (failed && failed.length > 0) {
  console.log(`Found ${failed.length} failed prospects (showing first 5):\n`);
  
  failed.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name || '?'} ${p.last_name || '?'}`);
    console.log(`   LinkedIn: ${p.linkedin_url || 'missing'}`);
    console.log(`   Error: ${p.error_message || p.personalization_data?.error || 'Unknown'}`);
    console.log();
  });
} else {
  console.log('No failed prospects found');
}
