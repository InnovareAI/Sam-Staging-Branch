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

console.log('\n🚫 Marking queued prospects as failed (flagged by Unipile)...\n');

// Mark all prospects with status='queued' as 'failed'
const { data, error } = await supabase
  .from('campaign_prospects')
  .update({
    status: 'failed',
    scheduled_send_at: null
  })
  .eq('status', 'queued')
  .select('id');

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log(`✅ Marked ${data?.length || 0} prospects as 'failed'\n`);
console.log('These prospects will not be retried.\n');
