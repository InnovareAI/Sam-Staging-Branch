#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The 3 campaigns
const CAMPAIGNS = [
  { name: 'Cha Canada Campaign', id: '35415fff-a230-48c6-ae91-e8f170cd3232' },
  { name: 'SAM Startup Canada', id: '3326aa89-9220-4bef-a1db-9c54f14fc536' }
];

console.log('\n🔍 Looking for untouched prospects in OTHER campaigns...\n');

for (const campaign of CAMPAIGNS) {
  console.log(`📂 ${campaign.name}`);
  
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status, contacted_at')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .is('contacted_at', null)
    .limit(5);
  
  if (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    continue;
  }
  
  console.log(`   Found ${prospects?.length || 0} pending prospects\n`);
  
  if (prospects && prospects.length > 0) {
    const prospect = prospects[0];
    const username = prospect.linkedin_url.split('/in/')[1]?.replace('/', '') || 'unknown';
    
    // Check for simple username (no special characters)
    if (/^[a-z0-9-]+$/.test(username)) {
      console.log(`✅ Selected: ${prospect.first_name} ${prospect.last_name}`);
      console.log(`   LinkedIn: ${prospect.linkedin_url}`);
      console.log(`   Username: ${username}`);
      console.log(`   Campaign: ${campaign.name}\n`);
      
      // Queue this prospect
      const scheduledSendAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'queued',
          scheduled_send_at: scheduledSendAt.toISOString()
        })
        .eq('id', prospect.id);
      
      if (updateError) {
        console.log(`   ❌ Failed to queue: ${updateError.message}\n`);
      } else {
        console.log(`✅ Queued for immediate send!\n`);
        console.log(`Next: Run send-scheduled-prospects-cron.mjs\n`);
      }
      
      process.exit(0);
    } else {
      console.log(`   ⚠️  Skipping ${prospect.first_name} ${prospect.last_name} - complex username: ${username}\n`);
    }
  }
}

console.log('❌ No suitable prospects found in any campaign\n');
