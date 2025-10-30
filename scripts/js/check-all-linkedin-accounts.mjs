#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccounts() {
  console.log('🔍 Checking ALL LinkedIn accounts across workspaces...\n');
  
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*, workspaces(name)')
    .eq('provider', 'linkedin')
    .order('created_at', { ascending: false });

  if (!accounts || accounts.length === 0) {
    console.log('❌ No LinkedIn accounts found in any workspace');
    console.log('\n💡 You need to:');
    console.log('   1. Connect LinkedIn via Unipile OAuth');
    console.log('   2. Or use N8N to sync Unipile accounts to database');
    return;
  }

  console.log(`✅ Found ${accounts.length} LinkedIn accounts:\n`);
  
  accounts.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.account_name || 'Unnamed'}`);
    console.log(`   Workspace: ${acc.workspaces?.name || 'Unknown'}`);
    console.log(`   Status: ${acc.status}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id || '❌ Not set'}`);
    console.log(`   Created: ${new Date(acc.created_at).toLocaleDateString()}`);
    console.log();
  });
}

checkAccounts();
