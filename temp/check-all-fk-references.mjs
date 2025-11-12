#!/usr/bin/env node

/**
 * Find ALL foreign key references to user 567ba664-812c-4bed-8c2f-96113b99f899
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

console.log('🔍 Finding ALL foreign key references to user:', USER_ID);
console.log('');

// Check all possible column names that might reference auth.users
const checks = [
  // SAM conversations
  { table: 'sam_conversation_messages', column: 'user_id' },
  { table: 'sam_conversation_threads', column: 'user_id' },

  // Workspace relations
  { table: 'workspace_members', column: 'user_id' },
  { table: 'workspace_prospects', column: 'user_id' },
  { table: 'workspace_prospects', column: 'added_by' },
  { table: 'workspace_prospects', column: 'created_by' },

  // Campaigns
  { table: 'campaigns', column: 'user_id' },
  { table: 'campaigns', column: 'created_by' },
  { table: 'campaign_prospects', column: 'added_by' },

  // Prospects
  { table: 'prospect_approval_data', column: 'user_id' },
  { table: 'prospect_approval_data', column: 'added_by' },

  // Knowledge base
  { table: 'knowledge_base', column: 'user_id' },
  { table: 'knowledge_base', column: 'created_by' },
  { table: 'knowledge_base', column: 'updated_by' },

  // Accounts
  { table: 'workspace_accounts', column: 'user_id' },
  { table: 'workspace_accounts', column: 'added_by' },
];

const references = [];

for (const check of checks) {
  try {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
      .eq(check.column, USER_ID);

    if (!error && count > 0) {
      console.log(`⚠️  ${check.table}.${check.column}: ${count} rows`);
      references.push({ table: check.table, column: check.column, count });
    }
  } catch (err) {
    // Column doesn't exist, skip silently
  }
}

console.log('');
console.log('📊 Summary:');
console.log(`   Total tables with references: ${references.length}`);
console.log(`   Total rows to delete: ${references.reduce((sum, r) => sum + r.count, 0)}`);
console.log('');

if (references.length > 0) {
  console.log('✅ SQL delete order (run in this order):');
  console.log('');
  references.forEach((ref, i) => {
    console.log(`-- ${i + 1}. Delete from ${ref.table}.${ref.column} (${ref.count} rows)`);
    console.log(`DELETE FROM ${ref.table} WHERE ${ref.column} = '${USER_ID}';`);
    console.log('');
  });
  console.log(`-- ${references.length + 1}. Finally, delete the user`);
  console.log(`DELETE FROM auth.users WHERE id = '${USER_ID}';`);
}
