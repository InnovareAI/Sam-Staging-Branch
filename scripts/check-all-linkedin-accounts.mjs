#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Checking all LinkedIn accounts in database...\n');

const { data: accounts, error } = await supabase
  .from('workspace_accounts')
  .select('id, account_name, unipile_account_id, connection_status, workspace_id, workspaces(name)')
  .eq('account_type', 'linkedin')
  .order('account_name');

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log(`Found ${accounts.length} LinkedIn accounts:\n`);

for (const account of accounts) {
  const workspaceName = account.workspaces?.name || 'Unknown';
  const status = account.connection_status === 'connected' ? '✅' : '❌';
  
  console.log(`${status} ${account.account_name}`);
  console.log(`   Workspace: ${workspaceName}`);
  console.log(`   Unipile ID: ${account.unipile_account_id}`);
  console.log(`   Status: ${account.connection_status}\n`);
}

const connected = accounts.filter(a => a.connection_status === 'connected');
console.log(`\n📊 Summary:`);
console.log(`   Total: ${accounts.length}`);
console.log(`   Connected: ${connected.length}`);
console.log(`   Disconnected: ${accounts.length - connected.length}\n`);

if (connected.length > 0) {
  console.log('✅ Available accounts to try:\n');
  connected.forEach(a => {
    console.log(`   - ${a.account_name} (${a.unipile_account_id})`);
  });
  console.log();
}
