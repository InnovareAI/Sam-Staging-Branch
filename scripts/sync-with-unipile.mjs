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

console.log('\n🔄 SYNCING WITH UNIPILE DATABASE\n');
console.log('='.repeat(80) + '\n');

// Fetch all accounts from Unipile
console.log('📡 Fetching accounts from Unipile API...\n');

const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;

const unipileResponse = await fetch(accountUrl, {
  headers: {
    'X-API-KEY': UNIPILE_API_KEY
  }
});

if (!unipileResponse.ok) {
  console.log('❌ Failed to fetch from Unipile:', unipileResponse.status);
  const text = await unipileResponse.text();
  console.log('Error:', text);
  process.exit(1);
}

const unipileData = await unipileResponse.json();
const unipileAccounts = unipileData.items || [];
console.log(`✅ Found ${unipileAccounts.length} accounts in Unipile\n`);

// Get all our database accounts
const { data: dbAccounts, error } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, account_name, platform, workspace_id, workspaces(name)');

if (error) {
  console.log('❌ Error fetching from database:', error.message);
  process.exit(1);
}

console.log(`📊 Found ${dbAccounts.length} accounts in our database\n`);

// Create set of Unipile account IDs
const unipileIds = new Set(unipileAccounts.map(a => a.account_id));

console.log('='.repeat(80) + '\n');
console.log('🔍 ANALYSIS:\n');

// Find accounts in DB but not in Unipile (should be deleted)
const toDelete = dbAccounts.filter(acc => !unipileIds.has(acc.unipile_account_id));

if (toDelete.length > 0) {
  console.log(`⚠️  ${toDelete.length} accounts in our DB but NOT in Unipile (orphaned):\n`);
  toDelete.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.account_name || 'Unnamed'} (${acc.platform})`);
    console.log(`   ID: ${acc.unipile_account_id}`);
    console.log(`   Workspace: ${acc.workspaces?.name}`);
    console.log('');
  });
} else {
  console.log('✅ No orphaned accounts found in database\n');
}

// Find accounts in Unipile but not in DB
const dbAccountIds = new Set(dbAccounts.map(a => a.unipile_account_id));
const toAdd = unipileAccounts.filter(a => !dbAccountIds.has(a.account_id));

if (toAdd.length > 0) {
  console.log(`ℹ️  ${toAdd.length} accounts in Unipile but NOT in our DB:\n`);
  toAdd.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.name || acc.email || 'Unnamed'} (${acc.provider})`);
    console.log(`   ID: ${acc.account_id}`);
    console.log('');
  });
} else {
  console.log('✅ All Unipile accounts are in our database\n');
}

console.log('='.repeat(80) + '\n');
console.log('💡 ACTION PLAN:\n');
console.log(`   Delete ${toDelete.length} orphaned accounts from our database`);
console.log(`   Keep ${dbAccounts.length - toDelete.length} accounts that exist in Unipile\n`);

if (toDelete.length > 0) {
  // Generate delete statements
  const deleteStatements = toDelete.map(acc => 
    `-- ${acc.account_name} (${acc.platform}) - Workspace: ${acc.workspaces?.name}\n` +
    `DELETE FROM workspace_accounts WHERE unipile_account_id = '${acc.unipile_account_id}';\n` +
    `DELETE FROM user_unipile_accounts WHERE unipile_account_id = '${acc.unipile_account_id}';`
  ).join('\n\n');

  fs.writeFileSync(
    path.join(__dirname, 'delete-orphaned-accounts.sql'),
    `-- ================================================================\n` +
    `-- DELETE ORPHANED ACCOUNTS (not in Unipile anymore)\n` +
    `-- Generated: ${new Date().toISOString()}\n` +
    `-- Total: ${toDelete.length} accounts\n` +
    `-- ================================================================\n\n` +
    deleteStatements
  );

  console.log('📝 Generated: scripts/delete-orphaned-accounts.sql\n');
  console.log('Run this SQL file to clean up orphaned accounts.\n');
}
