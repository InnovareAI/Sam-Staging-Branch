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
  .eq('id', 'aee63a0b-70bb-4ee7-bfa8-14de8b5c0870')
  .single();

console.log(`\n${data.first_name} ${data.last_name}`);
console.log(`Status: ${data.status}`);
console.log(`Contacted: ${data.contacted_at || 'null'}\n`);
