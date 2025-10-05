#!/usr/bin/env node
/**
 * Deploy prospect approval system migration via Supabase Management API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'latxadqrvrrrcvkktrog';

console.log('🚀 Deploying Prospect Approval System Migration...\n');

// Read the migration file
const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20251002000000_create_prospect_approval_system.sql'
);

const sql = fs.readFileSync(migrationPath, 'utf8');
console.log('📄 Migration file loaded');
console.log('📏 SQL length:', sql.length, 'characters\n');

// Use Supabase's SQL endpoint via PostgREST
const executeSQL = async () => {
  try {
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Total statements to execute: ${statements.length}\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.trim().startsWith('--')) {
        continue;
      }

      console.log(`⏳ [${i + 1}/${statements.length}] Executing...`);

      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: statement })
        });

        if (response.ok || response.status === 201) {
          successCount++;
          console.log(`   ✅ Success`);
        } else {
          const errorText = await response.text();
          errorCount++;
          errors.push({ statement: statement.substring(0, 100), error: errorText });
          console.log(`   ⚠️  Warning: ${response.status}`);
        }
      } catch (err) {
        errorCount++;
        errors.push({ statement: statement.substring(0, 100), error: err.message });
        console.log(`   ❌ Error: ${err.message}`);
      }
    }

    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (errors.length > 0 && errors.length < 10) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.statement}...`);
        console.log(`      ${e.error.substring(0, 200)}`);
      });
    }

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
};

executeSQL();
