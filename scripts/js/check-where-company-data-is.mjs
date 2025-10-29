#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Checking where company data might be stored\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, title, industry, personalization_data, linkedin_url')
  .eq('campaign_id', campaignId)
  .limit(10);

console.log('📋 Sample Prospects with ALL fields:\n');

prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   company_name: "${p.company_name || 'NULL'}"`);
  console.log(`   title: "${p.title || 'NULL'}"`);
  console.log(`   industry: "${p.industry || 'NULL'}"`);
  console.log(`   linkedin_url: "${p.linkedin_url}"`);
  console.log(`   personalization_data: ${JSON.stringify(p.personalization_data, null, 2)}`);
  console.log('');
});

// Check how these prospects were created
const { data: withSource } = await supabase
  .from('campaign_prospects')
  .select('personalization_data')
  .eq('campaign_id', campaignId)
  .limit(5);

console.log('\n📊 Personalization Data Sources:\n');
withSource.forEach((p, i) => {
  console.log(`${i + 1}. source: ${p.personalization_data?.source || 'MISSING'}`);
  console.log(`   uploaded_at: ${p.personalization_data?.uploaded_at || 'MISSING'}`);
  console.log(`   approved_at: ${p.personalization_data?.approved_at || 'MISSING'}`);
  console.log('');
});

