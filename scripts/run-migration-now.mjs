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

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251025_safe_linkedin_fix.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('🚀 Applying migration...\n');

// Split into statements and execute each
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)
  .filter(s => !s.startsWith('--'))
  .filter(s => !s.match(/^\/\*/));

let executed = 0;
let failed = 0;

for (const stmt of statements) {
  const preview = stmt.substring(0, 60).replace(/\s+/g, ' ');

  try {
    // Execute via REST API directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: stmt + ';' })
    });

    if (response.ok) {
      console.log(`✅ ${preview}...`);
      executed++;
    } else {
      const error = await response.text();
      console.log(`⚠️  ${preview}...`);
      console.log(`   ${error.substring(0, 100)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${preview}...`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

console.log(`\n✅ Executed: ${executed}`);
console.log(`⚠️  Failed: ${failed}\n`);
