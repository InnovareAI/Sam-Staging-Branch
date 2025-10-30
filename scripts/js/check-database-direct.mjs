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

async function check() {
  console.log('🔍 CHECKING DATABASE DIRECTLY\n');
  
  // Check if campaign exists
  const { data: campaign, error: campError } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', '73bedc34-3b24-4315-8cf1-043e454019af')
    .maybeSingle();
  
  console.log('Campaign:', campaign, campError);
  
  // Check prospects with no filters
  const { data: allProspects, error: prosError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .limit(100);
  
  console.log('\nTotal prospects in DB:', allProspects?.length, prosError);
  
  // Check prospects for this campaign
  const { data: campProspects, error: campProsError } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', '73bedc34-3b24-4315-8cf1-043e454019af');
  
  console.log('\nProspects for campaign 73bedc34:', campProspects?.length, campProsError);
  
  if (campProspects && campProspects.length > 0) {
    console.log('\nFirst prospect details:');
    console.log(JSON.stringify(campProspects[0], null, 2));
  }
}

check().catch(console.error);
