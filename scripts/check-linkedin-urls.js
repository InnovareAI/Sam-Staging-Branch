#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '3c984824-5561-4ba5-8b08-f34af2a00e27';

async function checkLinkedInUrls() {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, personalization_data')
    .eq('campaign_id', CAMPAIGN_ID)
    .limit(5);

  console.log('\n🔍 Sample LinkedIn URLs from campaign prospects:\n');

  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'NULL/MISSING'}`);

    // Check if there's a URL in personalization_data
    if (p.personalization_data) {
      const data = typeof p.personalization_data === 'string'
        ? JSON.parse(p.personalization_data)
        : p.personalization_data;

      if (data.linkedin_url) {
        console.log(`   URL in personalization_data: ${data.linkedin_url}`);
      }
    }
    console.log('');
  });

  // Check how many have missing URLs
  const { count: totalCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID);

  const { count: missingCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID)
    .is('linkedin_url', null);

  console.log(`📊 LinkedIn URL Status:`);
  console.log(`   Total prospects: ${totalCount}`);
  console.log(`   Missing URLs: ${missingCount || 0}`);
  console.log(`   With URLs: ${totalCount - (missingCount || 0)}`);
}

checkLinkedInUrls();
