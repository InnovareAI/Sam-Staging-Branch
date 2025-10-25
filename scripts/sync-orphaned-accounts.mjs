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

console.log('\n🔄 SYNCING ORPHANED ACCOUNTS\n');
console.log('='.repeat(70) + '\n');

// Find user_unipile_accounts without workspace_accounts
const { data: orphaned, error: orphanedError } = await supabase
  .from('v_linkedin_account_status')
  .select('*')
  .eq('mapping_status', 'missing_workspace_account');

if (orphanedError) {
  console.log('❌ Error finding orphaned accounts:', orphanedError.message);
  process.exit(1);
}

console.log(`Found ${orphaned?.length || 0} orphaned accounts\n`);

if (!orphaned || orphaned.length === 0) {
  console.log('✅ No orphaned accounts to sync\n');
  process.exit(0);
}

let synced = 0;
let failed = 0;

for (const account of orphaned) {
  try {
    // Get full account details
    const { data: userAccount } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('id', account.user_account_id)
      .single();

    if (!userAccount || !userAccount.workspace_id) {
      console.log(`⚠️  Skipping ${account.unipile_account_id} - no workspace_id`);
      failed++;
      continue;
    }

    // Create workspace_account
    const { error: insertError } = await supabase
      .from('workspace_accounts')
      .insert({
        workspace_id: userAccount.workspace_id,
        user_id: userAccount.user_id,
        account_type: userAccount.platform === 'LINKEDIN' ? 'linkedin' : 'email',
        account_identifier: userAccount.account_email || userAccount.linkedin_public_identifier || userAccount.unipile_account_id,
        account_name: userAccount.account_name,
        unipile_account_id: userAccount.unipile_account_id,
        connection_status: userAccount.connection_status === 'active' ? 'connected' : 'pending',
        is_active: true
      });

    if (insertError) {
      console.log(`❌ ${userAccount.account_name}: ${insertError.message}`);
      failed++;
    } else {
      console.log(`✅ Synced: ${userAccount.account_name} (${userAccount.platform})`);
      synced++;
    }
  } catch (err) {
    console.log(`❌ Error syncing account:`, err.message);
    failed++;
  }
}

console.log('\n' + '='.repeat(70));
console.log(`\n✅ Synced: ${synced}`);
console.log(`❌ Failed: ${failed}\n`);
