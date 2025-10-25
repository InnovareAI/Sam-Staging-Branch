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

console.log('\n🚨 CHECKING FOR MULTI-WORKSPACE ACCOUNT VIOLATIONS\n');
console.log('='.repeat(70) + '\n');

// Check workspace_accounts for duplicates
console.log('1. Checking workspace_accounts for same account in multiple workspaces...\n');

const { data: wsAccounts, error: wsError } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id, workspace_id, account_name, account_type');

if (wsError) {
  console.log('❌ Error:', wsError.message);
} else {
  const grouped = {};
  wsAccounts.forEach(acc => {
    if (!grouped[acc.unipile_account_id]) {
      grouped[acc.unipile_account_id] = [];
    }
    grouped[acc.unipile_account_id].push(acc);
  });

  const duplicates = Object.entries(grouped).filter(([_, accounts]) => {
    const uniqueWorkspaces = new Set(accounts.map(a => a.workspace_id));
    return uniqueWorkspaces.size > 1;
  });

  if (duplicates.length > 0) {
    console.log(`🚨 VIOLATION FOUND: ${duplicates.length} accounts in multiple workspaces!\n`);
    duplicates.forEach(([accountId, accounts]) => {
      const workspaces = [...new Set(accounts.map(a => a.workspace_id))];
      console.log(`❌ Account: ${accounts[0].account_name} (${accountId})`);
      console.log(`   Type: ${accounts[0].account_type}`);
      console.log(`   Workspaces: ${workspaces.length} different workspaces`);
      workspaces.forEach((ws, i) => {
        console.log(`   ${i + 1}. workspace_id: ${ws}`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No violations in workspace_accounts\n');
  }
}

// Check user_unipile_accounts for duplicates
console.log('2. Checking user_unipile_accounts for same account in multiple workspaces...\n');

const { data: userAccounts, error: userError } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, workspace_id, account_name, platform');

if (userError) {
  console.log('❌ Error:', userError.message);
} else {
  const grouped = {};
  userAccounts.forEach(acc => {
    if (!grouped[acc.unipile_account_id]) {
      grouped[acc.unipile_account_id] = [];
    }
    grouped[acc.unipile_account_id].push(acc);
  });

  const duplicates = Object.entries(grouped).filter(([_, accounts]) => {
    const uniqueWorkspaces = new Set(accounts.map(a => a.workspace_id).filter(w => w !== null));
    return uniqueWorkspaces.size > 1;
  });

  if (duplicates.length > 0) {
    console.log(`🚨 VIOLATION FOUND: ${duplicates.length} accounts in multiple workspaces!\n`);
    duplicates.forEach(([accountId, accounts]) => {
      const workspaces = [...new Set(accounts.map(a => a.workspace_id).filter(w => w !== null))];
      console.log(`❌ Account: ${accounts[0].account_name} (${accountId})`);
      console.log(`   Platform: ${accounts[0].platform}`);
      console.log(`   Workspaces: ${workspaces.length} different workspaces`);
      workspaces.forEach((ws, i) => {
        console.log(`   ${i + 1}. workspace_id: ${ws}`);
      });
      console.log('');
    });
  } else {
    console.log('✅ No violations in user_unipile_accounts\n');
  }
}

console.log('='.repeat(70) + '\n');
