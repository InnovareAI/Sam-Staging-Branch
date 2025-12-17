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

console.log('\n🔄 SYNCING UNIPILE ACCOUNT CONNECTION STATUS\n');
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
  .select('id, unipile_account_id, account_name, platform, workspace_id, connection_status, workspaces(name)');

if (error) {
  console.log('❌ Error fetching from database:', error.message);
  process.exit(1);
}

console.log(`📊 Found ${dbAccounts.length} accounts in our database\n`);

// Create map of Unipile accounts by ID with their connection status
const unipileAccountMap = new Map();
unipileAccounts.forEach(acc => {
  // Determine connection status from sources
  const hasOKSource = acc.sources?.some(source => source.status === 'OK');
  const hasCredentialIssue = acc.sources?.some(source => source.status === 'CREDENTIALS');

  let status = 'disconnected';
  if (hasOKSource) {
    status = 'active';
  } else if (hasCredentialIssue) {
    status = 'disconnected'; // Credential issues = needs reconnection
  }

  unipileAccountMap.set(acc.id, {
    name: acc.name,
    type: acc.type,
    status: status,
    sources: acc.sources || []
  });
});

console.log('='.repeat(80) + '\n');
console.log('🔍 ANALYZING CONNECTION STATUS:\n');

let updatedCount = 0;
let unchangedCount = 0;
let deletedCount = 0;

for (const dbAccount of dbAccounts) {
  const unipileAccount = unipileAccountMap.get(dbAccount.unipile_account_id);

  // Case 1: Account exists in Unipile
  if (unipileAccount) {
    const dbStatus = dbAccount.connection_status;
    const actualStatus = unipileAccount.status;

    if (dbStatus !== actualStatus) {
      console.log(`🔄 UPDATE: ${dbAccount.account_name} (${dbAccount.platform})`);
      console.log(`   Workspace: ${dbAccount.workspaces?.name || 'Unknown'}`);
      console.log(`   DB Status: ${dbStatus} → Unipile Status: ${actualStatus}`);
      console.log(`   Sources: ${unipileAccount.sources.map(s => s.status).join(', ')}`);

      // Update database
      const { error: updateError } = await supabase
        .from('user_unipile_accounts')
        .update({
          connection_status: actualStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbAccount.id);

      if (updateError) {
        console.log(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated successfully`);
        updatedCount++;
      }
      console.log('');
    } else {
      unchangedCount++;
    }
  }
  // Case 2: Account deleted from Unipile
  else {
    console.log(`🗑️  DELETE: ${dbAccount.account_name} (${dbAccount.platform})`);
    console.log(`   Workspace: ${dbAccount.workspaces?.name || 'Unknown'}`);
    console.log(`   DB Status: ${dbAccount.connection_status} → Unipile: NOT FOUND`);

    // Mark as disconnected (don't actually delete from DB)
    const { error: updateError } = await supabase
      .from('user_unipile_accounts')
      .update({
        connection_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', dbAccount.id);

    if (updateError) {
      console.log(`   ❌ Failed to update: ${updateError.message}`);
    } else {
      console.log(`   ✅ Marked as disconnected`);
      deletedCount++;
    }
    console.log('');
  }
}

console.log('='.repeat(80) + '\n');
console.log('📊 SUMMARY:\n');
console.log(`   Total accounts in DB: ${dbAccounts.length}`);
console.log(`   Updated: ${updatedCount}`);
console.log(`   Unchanged: ${unchangedCount}`);
console.log(`   Deleted from Unipile (marked disconnected): ${deletedCount}`);
console.log('');

// Show InnovareAI workspace status
console.log('='.repeat(80) + '\n');
console.log('🏢 INNOVAREAI WORKSPACE (babdcab8-1a78-4b2f-913e-6e9fd9821009):\n');

const { data: innovareaiAccounts, error: innovareaiError } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, account_name, platform, connection_status')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .eq('platform', 'LINKEDIN');

if (innovareaiError) {
  console.log('❌ Error fetching InnovareAI accounts:', innovareaiError.message);
} else {
  innovareaiAccounts.forEach(acc => {
    const icon = acc.connection_status === 'active' ? '✅' : '❌';
    console.log(`${icon} ${acc.account_name} - ${acc.connection_status.toUpperCase()}`);
    console.log(`   Account ID: ${acc.unipile_account_id}`);
    console.log('');
  });
}

console.log('='.repeat(80) + '\n');
console.log('✅ SYNC COMPLETE\n');
