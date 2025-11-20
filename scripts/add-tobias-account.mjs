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

console.log('\n🔍 Finding InnovareAI workspaces...\n');

// Find all IA workspaces
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%IA%')
  .order('name');

console.log('InnovareAI Workspaces:\n');
workspaces.forEach(w => {
  console.log(`  ${w.name}: ${w.id}`);
});
console.log();

// Check which ones already have accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('workspace_id, account_name')
  .in('workspace_id', workspaces.map(w => w.id))
  .eq('account_type', 'linkedin');

console.log('Current LinkedIn account assignments:\n');
workspaces.forEach(w => {
  const wsAccounts = accounts.filter(a => a.workspace_id === w.id);
  console.log(`  ${w.name}:`);
  if (wsAccounts.length > 0) {
    wsAccounts.forEach(a => console.log(`    - ${a.account_name}`));
  } else {
    console.log(`    (none)`);
  }
});
console.log();

// Suggest a workspace for Tobias (one without an account or IA5 if it exists)
const workspaceWithoutAccount = workspaces.find(w => 
  !accounts.some(a => a.workspace_id === w.id)
);

const suggestedWorkspace = workspaceWithoutAccount || workspaces.find(w => w.name.includes('IA5'));

if (suggestedWorkspace) {
  console.log(`💡 Suggested workspace: ${suggestedWorkspace.name} (${suggestedWorkspace.id})\n`);
} else {
  console.log(`💡 All workspaces have accounts. Using IA1: ${workspaces[0].id}\n`);
}

// Add Tobias account
const TOBIAS_UNIPILE_ID = 'v8-RaHZzTD60o6EVwqcpvg';
const targetWorkspace = suggestedWorkspace || workspaces[0];

console.log(`➕ Adding Tobias Linz to ${targetWorkspace.name}...\n`);

const { data: newAccount, error } = await supabase
  .from('workspace_accounts')
  .insert([{
    workspace_id: targetWorkspace.id,
    account_name: 'Tobias Linz',
    account_type: 'linkedin',
    unipile_account_id: TOBIAS_UNIPILE_ID,
    connection_status: 'connected'
  }])
  .select()
  .single();

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Account added successfully!\n');
console.log(`   ID: ${newAccount.id}`);
console.log(`   Name: ${newAccount.account_name}`);
console.log(`   Workspace: ${targetWorkspace.name}`);
console.log(`   Unipile ID: ${newAccount.unipile_account_id}\n`);

console.log('🎯 Ready to send campaigns from Tobias Linz!\n');
