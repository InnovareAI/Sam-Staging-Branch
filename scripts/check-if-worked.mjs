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

console.log('\n🔍 Checking if John P. Perkins was processed...\n');

// Find John P. Perkins
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, contacted_at')
  .ilike('first_name', 'John%')
  .ilike('last_name', '%Perkins%')
  .single();

if (prospect) {
  console.log(`Found: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`   Status: ${prospect.status}`);
  console.log(`   Contacted: ${prospect.contacted_at || 'null'}\n`);
  
  if (prospect.status === 'connection_requested' || prospect.status === 'connection_request_sent') {
    console.log('✅ Database WAS updated!\n');
  } else {
    console.log('❌ Database NOT updated (still pending)\n');
  }
} else {
  console.log('❌ Could not find prospect\n');
}

console.log('Also check Tobias\'s LinkedIn manually for John P. Perkins.\n');
