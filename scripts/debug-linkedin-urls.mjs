#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CAMPAIGN_ID = 'd33a2947-c2e4-4df2-a281-9d16b0bb9702';

console.log('\n🔍 DEBUGGING LINKEDIN URLs\n');
console.log('='.repeat(80) + '\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID);

console.log(`Found ${prospects.length} prospects in campaign\n`);

prospects.forEach((p, i) => {
  console.log(`${i + 1}. Prospect ID: ${p.id}`);
  console.log(`   LinkedIn URL: ${p.linkedin_url || 'NULL'}`);
  console.log(`   LinkedIn User ID: ${p.linkedin_user_id || 'NULL'}`);
  console.log(`   Name: ${p.name || 'NULL'}`);
  console.log('');
  
  if (p.linkedin_url) {
    console.log(`   Full URL: ${p.linkedin_url}`);
    console.log('');
  }
});
