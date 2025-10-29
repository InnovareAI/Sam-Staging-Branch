#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Checking where prospects came from\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, company_name, personalization_data')
  .eq('campaign_id', campaignId)
  .limit(5);

if (!prospects) {
  console.log('No prospects found');
  process.exit(0);
}

console.log('📋 Sample Prospects:\n');

prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Company: ${p.company_name || 'NULL'}`);
  console.log(`   LinkedIn: ${p.linkedin_url}`);
  console.log(`   Personalization Data:`);
  console.log(`   ${JSON.stringify(p.personalization_data, null, 2)}`);
  console.log('');
});

// Check where campaign prospects came from
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', campaignId)
  .single();

console.log('\n📊 Campaign Info:');
console.log(`   Name: ${campaign?.name}`);
console.log(`   Created: ${campaign?.created_at}`);
console.log(`   Data Source: ${campaign?.data_source || 'unknown'}`);

// Check if there's a prospect_approval_data table with original data
const { data: approvalData } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .limit(5);

if (approvalData && approvalData.length > 0) {
  console.log('\n📋 Original Approval Data (from SAM):\n');
  approvalData.slice(0, 3).forEach((p, i) => {
    console.log(`${i + 1}. Prospect ID: ${p.id}`);
    console.log(`   Contact Data:`);
    console.log(`   ${JSON.stringify(p.contact, null, 2)}`);
    console.log('');
  });
}
