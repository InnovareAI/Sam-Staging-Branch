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

const { data } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, status, contacted_at')
  .ilike('first_name', 'Maca')
  .single();

if (data) {
  const statusIcon = data.status === 'connection_requested' ? '✅' : '❌';
  console.log(`${statusIcon} ${data.first_name} ${data.last_name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Contacted: ${data.contacted_at || 'null'}`);

  if (data.status === 'connection_requested' && data.contacted_at) {
    console.log('\n🎉 SUCCESS! DATABASE TRACKING IS FIXED!');
  } else {
    console.log('\n❌ Database not updated yet');
  }
}
