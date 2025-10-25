#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkSchema() {
  console.log('\n🔍 CHECKING POSTGRESQL SCHEMA TYPES\n');
  console.log('='.repeat(70) + '\n');

  // Check workspace_accounts column types
  console.log('📊 workspace_accounts column types:\n');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, udt_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'workspace_accounts'
        AND column_name IN ('workspace_id', 'user_id', 'id', 'unipile_account_id')
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      // Try direct query if RPC fails
      const query = `
        SELECT column_name, data_type, udt_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'workspace_accounts'
        AND column_name IN ('workspace_id', 'user_id', 'id', 'unipile_account_id')
        ORDER BY ordinal_position;
      `;

      console.log('Using REST API query...\n');
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result);
      } else {
        console.log('Cannot query schema directly. Using SQL Editor manually...\n');
        console.log('Run this query in Supabase SQL Editor:');
        console.log(query);
      }
    } else {
      console.log(data);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Check user_unipile_accounts column types
  console.log('📊 user_unipile_accounts column types:\n');

  const schemaQuery = `
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('workspace_accounts', 'user_unipile_accounts', 'workspaces', 'linkedin_contacts')
AND column_name IN ('id', 'workspace_id', 'user_id', 'unipile_account_id')
ORDER BY table_name, ordinal_position;
  `;

  console.log('📋 Run this query in Supabase SQL Editor to see exact schema:\n');
  console.log(schemaQuery);
  console.log('\n' + '='.repeat(70));

  console.log('\n✅ Key things to check in SQL Editor:');
  console.log('1. workspace_accounts.workspace_id → Should be UUID not TEXT');
  console.log('2. user_unipile_accounts → Should have workspace_id column');
  console.log('3. All id columns → Should be UUID type');
  console.log('4. Foreign keys → Should exist and match types\n');
}

checkSchema().catch(console.error);
