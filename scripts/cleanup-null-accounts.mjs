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

console.log('\n🗑️  CLEANING UP NULL UNIPILE_ACCOUNT_ID ENTRIES\n');
console.log('='.repeat(80) + '\n');

// Find workspace_accounts with NULL unipile_account_id
const { data: nullAccounts, error } = await supabase
  .from('workspace_accounts')
  .select('*, workspaces(name)')
  .is('unipile_account_id', null);

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log(`Found ${nullAccounts.length} workspace_accounts with NULL unipile_account_id:\n`);

nullAccounts.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name || 'Unnamed'} (${acc.account_type})`);
  console.log(`   Workspace: ${acc.workspaces?.name}`);
  console.log(`   ID: ${acc.id}`);
  console.log('');
});

// Delete them
console.log('🗑️  Deleting orphaned accounts...\n');

let deletedCount = 0;

for (const acc of nullAccounts) {
  const { error: deleteError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('id', acc.id);

  if (!deleteError) {
    console.log(`✅ Deleted: ${acc.account_name} from ${acc.workspaces?.name}`);
    deletedCount++;
  } else {
    console.log(`❌ Failed to delete: ${acc.account_name}`);
    console.log(`   Error: ${deleteError.message}`);
  }
}

console.log('');
console.log('='.repeat(80));
console.log(`\n✅ CLEANUP COMPLETE: Deleted ${deletedCount} accounts with NULL unipile_account_id\n`);
