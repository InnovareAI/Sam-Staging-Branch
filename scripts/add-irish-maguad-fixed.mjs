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

console.log('\n➕ ADDING IRISH MAGUAD TO INNOVAREAI WORKSPACE\n');
console.log('='.repeat(80) + '\n');

const INNOVARE_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const UNIPILE_ACCOUNT_ID = 'avp6xHsCRZaP5uSPmjc2jg';

// Get workspace_accounts entry to find user_id
const { data: wsAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('unipile_account_id', UNIPILE_ACCOUNT_ID)
  .single();

console.log('✅ Found workspace_accounts entry for user:', wsAccount.user_id);
console.log('');

// Create user_unipile_accounts entry with correct columns
console.log('➕ Creating user_unipile_accounts entry...\n');

const { data: newAccount, error: insertError } = await supabase
  .from('user_unipile_accounts')
  .insert({
    user_id: wsAccount.user_id,
    workspace_id: INNOVARE_WORKSPACE_ID,
    unipile_account_id: UNIPILE_ACCOUNT_ID,
    platform: 'LINKEDIN',
    account_name: 'Irish Maguad',
    connection_status: 'active',
    linkedin_public_identifier: 'irish-maguad-202737171'
  })
  .select()
  .single();

if (insertError) {
  console.log('❌ Error creating account:', insertError.message);
  process.exit(1);
}

console.log('✅ Successfully added Irish Maguad!');
console.log('');
console.log('Details:');
console.log(`   ID: ${newAccount.id}`);
console.log(`   Name: ${newAccount.account_name}`);
console.log(`   Platform: ${newAccount.platform}`);
console.log(`   Workspace: ${newAccount.workspace_id}`);
console.log(`   User: ${newAccount.user_id}`);
console.log(`   LinkedIn: linkedin.com/in/${newAccount.linkedin_public_identifier}`);
console.log('');

console.log('='.repeat(80));
console.log('\n✅ IRISH MAGUAD SUCCESSFULLY ADDED TO INNOVAREAI WORKSPACE\n');
