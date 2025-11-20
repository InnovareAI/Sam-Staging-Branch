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

console.log('\n🔄 Resetting queued prospects to pending status...\n');

// Reset all prospects with status='queued' back to 'pending'
const { data, error } = await supabase
  .from('campaign_prospects')
  .update({
    status: 'pending',
    scheduled_send_at: null
  })
  .eq('status', 'queued')
  .select('id');

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log(`✅ Reset ${data?.length || 0} prospects from 'queued' to 'pending'\n`);
console.log('These prospects can now be properly executed through the Campaign Hub UI.\n');
