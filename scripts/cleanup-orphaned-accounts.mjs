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
const UNIPILE_DSN = envContent.match(/UNIPILE_DSN=(.*)/)[1].trim();
const UNIPILE_API_KEY = envContent.match(/UNIPILE_API_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log('\n🧹 CLEANING ORPHANED ACCOUNTS\n');
console.log('='.repeat(80) + '\n');

// Fetch Unipile accounts
const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;
const response = await fetch(accountUrl, {
  headers: { 'X-API-KEY': UNIPILE_API_KEY }
});

if (!response.ok) {
  console.log('❌ Failed to fetch from Unipile');
  process.exit(1);
}

const unipileData = await response.json();
const unipileAccounts = unipileData.items || [];
console.log(`✅ Unipile has ${unipileAccounts.length} active accounts\n`);

// Get our database accounts
const { data: dbAccounts, error } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, account_name, platform, workspace_id, workspaces(name)');

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log(`📊 Our database has ${dbAccounts.length} accounts\n`);

// Create set of valid Unipile IDs (using 'id' field)
const validIds = new Set(unipileAccounts.map(a => a.id));

console.log('✅ Valid account IDs from Unipile:');
Array.from(validIds).forEach(id => console.log(`   - ${id}`));
console.log('');

// Find orphaned accounts
const orphaned = dbAccounts.filter(acc => !validIds.has(acc.unipile_account_id));

console.log('='.repeat(80) + '\n');
console.log(`⚠️  FOUND ${orphaned.length} ORPHANED ACCOUNTS TO DELETE:\n`);

orphaned.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name || 'Unnamed'} (${acc.platform})`);
  console.log(`   ID: ${acc.unipile_account_id}`);
  console.log(`   Workspace: ${acc.workspaces?.name || 'Unknown'}`);
  console.log('');
});

console.log('='.repeat(80) + '\n');
console.log(`✅ WILL KEEP ${dbAccounts.length - orphaned.length} ACCOUNTS (exist in Unipile)\n`);

// DELETE the orphaned accounts
console.log('🗑️  Deleting orphaned accounts...\n');

let deletedCount = 0;

for (const acc of orphaned) {
  // Delete from workspace_accounts first
  const { error: waError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('unipile_account_id', acc.unipile_account_id);

  // Delete from user_unipile_accounts
  const { error: uaError } = await supabase
    .from('user_unipile_accounts')
    .delete()
    .eq('unipile_account_id', acc.unipile_account_id);

  if (!waError && !uaError) {
    console.log(`✅ Deleted: ${acc.account_name} (${acc.unipile_account_id})`);
    deletedCount++;
  } else {
    console.log(`❌ Failed to delete: ${acc.account_name}`);
    if (waError) console.log(`   workspace_accounts error: ${waError.message}`);
    if (uaError) console.log(`   user_unipile_accounts error: ${uaError.message}`);
  }
}

console.log('');
console.log('='.repeat(80));
console.log(`\n✅ CLEANUP COMPLETE: Deleted ${deletedCount} orphaned accounts\n`);
console.log(`📊 Remaining accounts: ${dbAccounts.length - deletedCount}\n`);
