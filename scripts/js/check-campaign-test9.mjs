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

async function checkTest9() {
  console.log('🔍 CHECKING "test 9" CAMPAIGN\n');
  
  // Find the campaign by name
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .ilike('name', '%test 9%');
  
  console.log(`Found ${campaigns?.length || 0} campaigns matching "test 9":\n`);
  
  for (const campaign of campaigns || []) {
    console.log(`Campaign: ${campaign.name}`);
    console.log(`ID: ${campaign.id}`);
    console.log(`Status: ${campaign.status}`);
    console.log(`Created: ${new Date(campaign.created_at).toLocaleDateString()}`);
    
    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);
    
    const ready = prospects?.filter(p => 
      !p.contacted_at && 
      p.linkedin_url && 
      ['pending', 'approved', 'ready_to_message'].includes(p.status)
    ) || [];
    
    console.log(`Total prospects: ${prospects?.length || 0}`);
    console.log(`Ready: ${ready.length}`);
    
    if (prospects && prospects.length > 0) {
      console.log('\nProspect details:');
      prospects.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
        console.log(`     Added by Unipile: ${p.added_by_unipile_account || 'NULL'}`);
      });
    }
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

checkTest9().catch(console.error);
