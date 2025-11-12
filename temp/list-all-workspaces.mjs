#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 All Workspaces with Unipile Accounts\n');

const { data: workspaces } = await supabase
  .from('workspaces')
  .select(`
    id,
    name,
    workspace_accounts (
      account_name,
      unipile_account_id,
      is_active
    )
  `)
  .order('created_at', { ascending: false });

console.log(`Found ${workspaces.length} workspaces:\n`);

workspaces.forEach((w, i) => {
  console.log(`${i + 1}. ${w.name}`);
  console.log(`   ID: ${w.id}`);
  
  if (w.workspace_accounts && w.workspace_accounts.length > 0) {
    w.workspace_accounts.forEach(acc => {
      console.log(`   Account: ${acc.account_name}`);
      console.log(`   Unipile ID: ${acc.unipile_account_id}`);
      console.log(`   Active: ${acc.is_active}`);
    });
  } else {
    console.log('   No Unipile accounts');
  }
  console.log('');
});

// Charissa's Unipile ID from earlier scan
const charissaUnipileId = '4nt1J-blSnGUPBjH2Nfjpg';

const { data: charissaAccount } = await supabase
  .from('workspace_accounts')
  .select('*, workspaces(name)')
  .eq('unipile_account_id', charissaUnipileId)
  .single();

if (charissaAccount) {
  console.log('✅ Found Charissa\'s account:');
  console.log(`   Workspace: ${charissaAccount.workspaces.name}`);
  console.log(`   Account: ${charissaAccount.account_name}`);
} else {
  console.log('❌ Charissa\'s Unipile account not linked to any workspace');
}
