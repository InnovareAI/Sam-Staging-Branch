#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, linkedin_user_id')
    .eq('campaign_id', campaignId);

  console.log('Prospects in Mexico Marketing campaign:\n');
  prospects.forEach(p => {
    const hasLinkedInId = p.linkedin_user_id ? 'Yes' : 'No';
    console.log(`  ${p.first_name} ${p.last_name}`);
    console.log(`    Status: ${p.status}`);
    console.log(`    LinkedIn ID: ${hasLinkedInId}`);
    console.log('');
  });
}

checkProspects();
