#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Checking if company data exists in prospect_approval_data\n');

// Get campaign prospects with their source approval data
const { data: campaignProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, personalization_data')
  .eq('campaign_id', campaignId)
  .limit(5);

if (!campaignProspects || campaignProspects.length === 0) {
  console.log('No campaign prospects found');
  process.exit(0);
}

console.log('📋 Current Campaign Prospects:\n');
campaignProspects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Company in campaign_prospects: "${p.company_name || 'NULL'}"`);
  console.log(`   Source: ${p.personalization_data?.source || 'unknown'}`);
  console.log('');
});

// Now check the original approval data
const { data: approvalData } = await supabase
  .from('prospect_approval_data')
  .select('prospect_id, name, title, company, contact')
  .eq('approval_status', 'approved')
  .limit(10);

console.log('\n📦 Original Approval Data (prospect_approval_data):\n');

if (approvalData && approvalData.length > 0) {
  approvalData.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Title: "${p.title || 'NULL'}"`);
    console.log(`   Company field (JSONB):`);
    console.log(`     ${JSON.stringify(p.company, null, 2)}`);
    console.log(`   Contact field (JSONB):`);
    console.log(`     ${JSON.stringify(p.contact, null, 2)}`);
    console.log('');
  });
} else {
  console.log('No approval data found');
}

