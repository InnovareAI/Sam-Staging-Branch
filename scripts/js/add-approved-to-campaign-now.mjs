#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sessionId = '9a24169e-0109-4504-94b8-333114a6ed27';
const campaignId = '138bf756-e5c0-4d26-b0bd-b2f4f8008baf';

console.log('🚀 Adding approved prospects to campaign...\n');

// Get approved prospects from this session
const { data: prospects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('session_id', sessionId);

console.log(`Found ${prospects.length} approved prospects\n`);

// Get workspace_id from campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('workspace_id')
  .eq('id', campaignId)
  .single();

let added = 0;
let errors = 0;

for (const prospect of prospects) {
  try {
    const { error } = await supabase
      .from('campaign_prospects')
      .insert({
        campaign_id: campaignId,
        workspace_id: campaign.workspace_id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        name: prospect.name,
        linkedin_url: prospect.linkedin_url,
        company_name: prospect.company_name,
        title: prospect.title,
        location: prospect.location,
        headline: prospect.headline,
        status: 'pending',
        personalization_data: prospect.personalization_data || {}
      });

    if (error) {
      console.log(`❌ ${prospect.name}: ${error.message}`);
      errors++;
    } else {
      console.log(`✅ ${prospect.name}`);
      added++;
    }
  } catch (error) {
    console.log(`❌ ${prospect.name}: ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Added: ${added} prospects`);
console.log(`   ❌ Errors: ${errors}`);

if (added > 0) {
  console.log(`\n✅ Campaign now has ${added} prospects ready!`);
}
