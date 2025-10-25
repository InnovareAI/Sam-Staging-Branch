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

console.log('\n🔍 CHECKING ACCOUNT: mERQmojtSZq5GeomZZazlw\n');
console.log('='.repeat(80) + '\n');

// Check this specific account
const { data: account, error: accError } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .eq('unipile_account_id', 'mERQmojtSZq5GeomZZazlw')
  .single();

if (accError) {
  console.log('❌ Error:', accError.message);
} else {
  console.log('📱 Account Details:');
  console.log(`   Name: ${account.account_name}`);
  console.log(`   Platform: ${account.platform}`);
  console.log(`   Status: ${account.connection_status}`);
  console.log(`   Workspace ID: ${account.workspace_id}`);
  console.log(`   User ID: ${account.user_id}`);
  console.log(`   Created: ${new Date(account.created_at).toLocaleString()}`);
  console.log('');
}

// Get workspace name
const { data: workspace } = await supabase
  .from('workspaces')
  .select('name, slug')
  .eq('id', account.workspace_id)
  .single();

console.log(`🏢 Workspace: ${workspace?.name || 'Unknown'}`);
console.log('');

// Get user details
const { data: user } = await supabase
  .from('users')
  .select('email, name')
  .eq('id', account.user_id)
  .single();

console.log(`👤 User: ${user?.email || user?.name || 'Unknown'}`);
console.log('');

// Check all accounts for tl@innovareai.com
console.log('='.repeat(80));
console.log('\n📊 ALL ACCOUNTS FOR tl@innovareai.com:\n');

const { data: userByEmail } = await supabase
  .from('users')
  .select('id')
  .eq('email', 'tl@innovareai.com')
  .single();

if (userByEmail) {
  const { data: allAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('*, workspaces(name)')
    .eq('user_id', userByEmail.id)
    .order('created_at', { ascending: false });

  console.log(`Total accounts: ${allAccounts?.length || 0}\n`);
  
  allAccounts?.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.account_name || acc.account_email || 'Unnamed'} (${acc.platform})`);
    console.log(`   ID: ${acc.unipile_account_id}`);
    console.log(`   Status: ${acc.connection_status}`);
    console.log(`   Workspace: ${acc.workspaces?.name}`);
    console.log(`   Created: ${new Date(acc.created_at).toLocaleString()}`);
    console.log('');
  });
}
