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

const { data: queuedProspects } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, campaign_id')
  .eq('status', 'queued')
  .order('scheduled_send_at', { ascending: true });

console.log(`\nQueued prospects (${queuedProspects?.length || 0} total):\n`);

if (queuedProspects && queuedProspects.length > 0) {
  queuedProspects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  });
} else {
  console.log('None');
}

console.log('\n');
