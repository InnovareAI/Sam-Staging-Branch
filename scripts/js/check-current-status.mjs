#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, contacted_at, personalization_data')
    .eq('campaign_id', '73bedc34-3b24-4315-8cf1-043e454019af')
    .order('updated_at', { ascending: false });

  console.log('\n📊 CURRENT PROSPECT STATUS\n');
  
  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Contacted: ${p.contacted_at ? 'YES' : 'NO'}`);
    if (p.personalization_data?.queued_at) {
      console.log(`   Queued at: ${new Date(p.personalization_data.queued_at).toLocaleString()}`);
    }
    console.log('');
  });
}

checkStatus().catch(console.error);
