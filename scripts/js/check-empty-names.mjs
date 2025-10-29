#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Latest campaign
const campaignId = 'bab75edd-7bf2-4d8e-a638-dfbe42f1b57b'; // 20251029-IAI-test 2

console.log('🔍 Checking ALL prospects in latest campaign\n');

const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status')
  .eq('campaign_id', campaignId);

console.log(`Total prospects: ${allProspects?.length || 0}\n`);

allProspects?.forEach((p, i) => {
  const hasIssue = !p.first_name || !p.last_name || p.first_name === '' || p.last_name === '';
  
  console.log(`${i + 1}. ${hasIssue ? '⚠️ ' : '✅'} ${p.first_name || '(empty)'} ${p.last_name || '(empty)'}`);
  console.log(`   Company: ${p.company_name || '(empty)'}`);
  console.log(`   LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
  console.log(`   Status: ${p.status}`);
  
  if (hasIssue) {
    console.log(`   >>> This prospect has missing/empty name and will fail messaging`);
  }
  console.log('');
});
