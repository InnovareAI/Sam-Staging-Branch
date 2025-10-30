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

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a';

async function checkStatus() {
  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status, launched_at')
    .eq('id', CAMPAIGN_ID)
    .single();
  
  console.log('Campaign status:', campaign.status);
  console.log('Launched at:', campaign.launched_at);
  
  // Get prospect
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .limit(5);
  
  console.log('\nProspects:');
  prospects.forEach(p => {
    console.log(`  ${p.first_name} ${p.last_name}:`);
    console.log(`    Status: ${p.status}`);
    console.log(`    LinkedIn URL: ${p.linkedin_url}`);
    console.log(`    Contacted: ${p.contacted_at}`);
    console.log(`    Personalization data:`, JSON.stringify(p.personalization_data, null, 2));
  });
}

checkStatus().catch(console.error);
