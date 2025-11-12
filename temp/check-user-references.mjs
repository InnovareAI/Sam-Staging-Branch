#!/usr/bin/env node

/**
 * Find all references to user 567ba664-812c-4bed-8c2f-96113b99f899
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = '567ba664-812c-4bed-8c2f-96113b99f899';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🔍 Finding all references to user:', USER_ID);
console.log('');

// Check all tables that might reference this user
const checks = [
  { table: 'sam_conversation_messages', column: 'user_id' },
  { table: 'sam_conversation_threads', column: 'user_id' },
  { table: 'workspace_members', column: 'user_id' },
  { table: 'campaign_prospects', column: 'user_id' },
  { table: 'campaigns', column: 'user_id' },
  { table: 'workspace_prospects', column: 'user_id' },
  { table: 'prospect_approval_data', column: 'user_id' },
  { table: 'knowledge_base', column: 'user_id' },
  { table: 'workspace_accounts', column: 'user_id' },
];

for (const check of checks) {
  try {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
      .eq(check.column, USER_ID);

    if (error) {
      console.log(`❌ ${check.table}.${check.column}: Error - ${error.message}`);
    } else if (count > 0) {
      console.log(`⚠️  ${check.table}.${check.column}: ${count} rows`);
    } else {
      console.log(`✅ ${check.table}.${check.column}: 0 rows`);
    }
  } catch (err) {
    console.log(`❌ ${check.table}.${check.column}: ${err.message}`);
  }
}

console.log('');
