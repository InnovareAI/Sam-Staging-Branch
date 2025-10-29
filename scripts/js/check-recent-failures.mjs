#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking most recent campaign failures\n');

// Get the most recently updated prospect with an error
const { data: failedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status, error_message, personalization_data, updated_at')
  .order('updated_at', { ascending: false })
  .limit(5);

console.log('📋 Most Recent Prospects (last 5):\n');

failedProspects?.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   Company: ${p.company_name || 'NULL'}`);
  console.log(`   LinkedIn: ${p.linkedin_url || 'NULL'}`);
  console.log(`   Error: ${p.error_message || 'none'}`);
  console.log(`   Last updated: ${p.updated_at}`);
  
  if (p.personalization_data?.error) {
    console.log(`   Personalization error: ${p.personalization_data.error}`);
  }
  console.log('');
});
