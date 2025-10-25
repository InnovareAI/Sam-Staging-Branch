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

console.log('\n📊 ACCOUNT MAPPING PER WORKSPACE\n');
console.log('='.repeat(80) + '\n');

// Get all workspaces
const { data: workspaces, error: wsError } = await supabase
  .from('workspaces')
  .select('id, name, slug')
  .order('name');

if (wsError) {
  console.log('❌ Error fetching workspaces:', wsError.message);
  process.exit(1);
}

// Get all accounts from both tables
const { data: userAccounts, error: uaError } = await supabase
  .from('user_unipile_accounts')
  .select('*');

const { data: workspaceAccounts, error: waError } = await supabase
  .from('workspace_accounts')
  .select('*');

if (uaError || waError) {
  console.log('❌ Error fetching accounts');
  process.exit(1);
}

let totalAccounts = 0;

for (const workspace of workspaces) {
  console.log(`🏢 ${workspace.name}`);
  console.log(`   ID: ${workspace.id}`);
  console.log(`   Slug: ${workspace.slug}`);
  console.log('');

  // Get accounts for this workspace
  const wsUserAccounts = userAccounts.filter(a => a.workspace_id === workspace.id);
  const wsWorkspaceAccounts = workspaceAccounts.filter(a => a.workspace_id === workspace.id);

  // Group by type
  const linkedinAccounts = wsUserAccounts.filter(a => a.platform === 'LINKEDIN');
  const emailAccounts = wsUserAccounts.filter(a => a.platform === 'GOOGLE_OAUTH' || a.platform === 'MESSAGING');

  console.log(`   📱 LinkedIn Accounts: ${linkedinAccounts.length}`);
  linkedinAccounts.forEach((acc, i) => {
    const wsAcc = wsWorkspaceAccounts.find(w => w.unipile_account_id === acc.unipile_account_id);
    const status = wsAcc ? '✅' : '⚠️ ';
    console.log(`      ${i + 1}. ${status} ${acc.account_name || 'Unnamed'}`);
    console.log(`         unipile_account_id: ${acc.unipile_account_id}`);
    console.log(`         connection_status: ${acc.connection_status}`);
    if (acc.linkedin_public_identifier) {
      console.log(`         LinkedIn: linkedin.com/in/${acc.linkedin_public_identifier}`);
    }
    if (!wsAcc) {
      console.log(`         ⚠️  Missing in workspace_accounts`);
    }
    console.log('');
  });

  console.log(`   📧 Email Accounts: ${emailAccounts.length}`);
  emailAccounts.forEach((acc, i) => {
    const wsAcc = wsWorkspaceAccounts.find(w => w.unipile_account_id === acc.unipile_account_id);
    const status = wsAcc ? '✅' : '⚠️ ';
    console.log(`      ${i + 1}. ${status} ${acc.account_name || acc.account_email || 'Unnamed'}`);
    console.log(`         unipile_account_id: ${acc.unipile_account_id}`);
    console.log(`         connection_status: ${acc.connection_status}`);
    if (acc.account_email) {
      console.log(`         Email: ${acc.account_email}`);
    }
    if (!wsAcc) {
      console.log(`         ⚠️  Missing in workspace_accounts`);
    }
    console.log('');
  });

  // Check for workspace_accounts not in user_unipile_accounts
  const orphanedWS = wsWorkspaceAccounts.filter(
    wa => !wsUserAccounts.find(ua => ua.unipile_account_id === wa.unipile_account_id)
  );

  if (orphanedWS.length > 0) {
    console.log(`   ⚠️  Orphaned workspace_accounts: ${orphanedWS.length}`);
    orphanedWS.forEach((acc, i) => {
      console.log(`      ${i + 1}. ${acc.account_name || 'Unnamed'} (${acc.account_type})`);
      console.log(`         unipile_account_id: ${acc.unipile_account_id}`);
      console.log(`         ⚠️  Missing in user_unipile_accounts`);
      console.log('');
    });
  }

  const totalForWorkspace = wsUserAccounts.length;
  totalAccounts += totalForWorkspace;

  console.log(`   📊 Total Accounts: ${totalForWorkspace}`);
  console.log(`   📊 Fully Mapped: ${wsUserAccounts.filter(ua =>
    wsWorkspaceAccounts.find(wa => wa.unipile_account_id === ua.unipile_account_id)
  ).length}`);

  console.log('');
  console.log('-'.repeat(80));
  console.log('');
}

// Summary
console.log('📈 SUMMARY');
console.log('');
console.log(`Total Workspaces: ${workspaces.length}`);
console.log(`Total Accounts: ${totalAccounts}`);
console.log(`LinkedIn Accounts: ${userAccounts.filter(a => a.platform === 'LINKEDIN').length}`);
console.log(`Email Accounts: ${userAccounts.filter(a => a.platform !== 'LINKEDIN').length}`);
console.log('');

// Check for accounts without workspace_id
const noWorkspace = userAccounts.filter(a => !a.workspace_id);
if (noWorkspace.length > 0) {
  console.log(`⚠️  Accounts without workspace_id: ${noWorkspace.length}`);
  noWorkspace.forEach(acc => {
    console.log(`   - ${acc.account_name || 'Unnamed'} (${acc.platform})`);
  });
  console.log('');
}

console.log('='.repeat(80) + '\n');
