#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('❌ Failed Prospects Analysis\n');

const { data: failed } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, linkedin_url, error_message, personalization_data, contacted_at')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .limit(5);

if (!failed || failed.length === 0) {
  console.log('No failed prospects found');
  process.exit(0);
}

console.log(`Showing first 5 of 31 failed prospects:\n`);

failed.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name || 'Unknown'} ${p.last_name || ''}`);
  console.log(`   LinkedIn: ${p.linkedin_url || 'N/A'}`);
  console.log(`   Error: ${p.error_message || 'No error message'}`);
  
  // Check personalization_data for error details
  if (p.personalization_data?.error) {
    console.log(`   Details: ${p.personalization_data.error}`);
  }
  
  if (p.contacted_at) {
    console.log(`   Attempted: ${p.contacted_at}`);
  }
  
  console.log();
});
