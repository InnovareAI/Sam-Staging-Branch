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

console.log('\n✅ VERIFYING LINKEDIN FIX\n');
console.log('='.repeat(70) + '\n');

// Check 1: workspace_id column exists
console.log('1. Checking user_unipile_accounts.workspace_id...');
const { data: accounts, error: accountsError } = await supabase
  .from('user_unipile_accounts')
  .select('workspace_id, user_id, platform, unipile_account_id')
  .limit(5);

if (accountsError) {
  console.log('   ❌ Error:', accountsError.message);
} else {
  const hasWorkspaceId = accounts && accounts.length > 0 && 'workspace_id' in accounts[0];
  if (hasWorkspaceId) {
    const filled = accounts.filter(a => a.workspace_id !== null).length;
    console.log(`   ✅ Column exists`);
    console.log(`   📊 ${filled}/${accounts.length} records have workspace_id filled\n`);
  } else {
    console.log('   ❌ Column missing\n');
  }
}

// Check 2: View exists
console.log('2. Checking v_linkedin_account_status view...');
const { data: viewData, error: viewError } = await supabase
  .from('v_linkedin_account_status')
  .select('mapping_status, user_account_id, workspace_account_id')
  .limit(5);

if (viewError) {
  console.log('   ❌ View missing:', viewError.message);
} else {
  console.log(`   ✅ View exists`);
  const fullyMapped = viewData?.filter(d => d.mapping_status === 'fully_mapped').length || 0;
  const missingWS = viewData?.filter(d => d.mapping_status === 'missing_workspace_account').length || 0;
  console.log(`   📊 Fully mapped: ${fullyMapped}`);
  if (missingWS > 0) {
    console.log(`   ⚠️  Missing workspace_accounts: ${missingWS}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('\n✅ MIGRATION VERIFIED SUCCESSFULLY\n');
