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

async function resetProspects() {
  console.log('🔄 Resetting queued prospects back to approved status\n');
  
  // Get prospects stuck in queued_in_n8n
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'queued_in_n8n')
    .is('contacted_at', null);
  
  console.log(`Found ${prospects?.length || 0} prospects to reset\n`);
  
  if (!prospects || prospects.length === 0) {
    console.log('No prospects to reset');
    return;
  }
  
  for (const prospect of prospects) {
    console.log(`Resetting: ${prospect.first_name} ${prospect.last_name}`);
    
    const { error } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'approved',
        personalization_data: {
          ...prospect.personalization_data,
          reset_reason: 'N8N workflow was inactive',
          reset_at: new Date().toISOString()
        }
      })
      .eq('id', prospect.id);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Reset to approved`);
    }
  }
  
  console.log('\n✅ All prospects reset');
}

resetProspects().catch(console.error);
