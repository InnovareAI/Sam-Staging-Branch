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

console.log('\n🔍 CHECKING WHAT TABLES ACTUALLY EXIST\n');
console.log('='.repeat(70) + '\n');

const tablesToCheck = [
  'user_unipile_accounts',
  'workspace_accounts',
  'workspaces',
  'workspace_members',
  'linkedin_contacts',
  'linkedin_discovery_jobs',
  'campaign_prospects',
  'workspace_prospects'
];

for (const table of tablesToCheck) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ${table} - ${error.message}`);
    } else {
      console.log(`✅ ${table} - EXISTS`);
      if (data && data.length > 0) {
        console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
      }
    }
  } catch (err) {
    console.log(`❌ ${table} - ${err.message}`);
  }
}

console.log('\n' + '='.repeat(70) + '\n');
