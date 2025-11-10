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

async function checkFullProspectData() {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .limit(3);

  console.log('\n🔍 Full prospect data from campaign_prospects:\n');

  prospects?.forEach((p, i) => {
    console.log(`\n${i + 1}. Prospect ID: ${p.id}`);
    console.log(JSON.stringify(p, null, 2));
  });
}

checkFullProspectData();
