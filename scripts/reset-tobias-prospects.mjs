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

console.log('\n🔄 Resetting prospects sent from Tobias account (last 24h)...\n');

// Find all prospects with status='connection_requested' in the last 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, contacted_at')
  .eq('status', 'connection_requested')
  .gte('contacted_at', yesterday);

if (error) {
  console.error('❌ Error finding prospects:', error.message);
  process.exit(1);
}

console.log(`Found ${prospects?.length || 0} prospects to reset\n`);

if (prospects && prospects.length > 0) {
  console.log('Prospects:');
  prospects.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.first_name} ${p.last_name} - ${p.contacted_at}`);
  });

  console.log('\n🔄 Resetting to pending status...\n');

  const { data: updated, error: updateError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'pending',
      contacted_at: null
    })
    .eq('status', 'connection_requested')
    .gte('contacted_at', yesterday)
    .select('id');

  if (updateError) {
    console.error('❌ Error updating prospects:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ Reset ${updated?.length || 0} prospects to 'pending' status\n`);
  console.log('These prospects can now be re-executed through Campaign Hub UI.\n');
} else {
  console.log('No prospects to reset.\n');
}
