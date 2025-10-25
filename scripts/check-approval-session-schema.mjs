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

console.log('\n🔍 CHECKING PROSPECT APPROVAL SESSIONS SCHEMA\n');
console.log('='.repeat(80) + '\n');

// Get sample from prospect_approval_sessions
const { data: sample, error } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .limit(1)
  .single();

if (error) {
  console.log('❌ Error:', error.message);
} else if (sample) {
  console.log('Sample prospect_approval_sessions record:\n');
  console.log(JSON.stringify(sample, null, 2));
  console.log('\n');
  console.log('Fields:', Object.keys(sample).join(', '));
} else {
  console.log('No data found in prospect_approval_sessions');
}

console.log('\n');
