#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🔍 Checking Mich Campaign Account Configuration\n');

// Get campaign with workspace info
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*, workspaces(id, name)')
  .eq('id', CAMPAIGN_ID)
  .single();

console.log(`Campaign: ${campaign.name}`);
console.log(`Workspace: ${campaign.workspaces.name} (${campaign.workspaces.id})`);
console.log('');

// Get workspace accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id);

console.log(`Workspace Accounts: ${accounts?.length || 0}\n`);

if (accounts && accounts.length > 0) {
  accounts.forEach(acc => {
    const active = acc.is_active ? '🟢' : '🔴';
    console.log(`${active} ${acc.account_type}: ${acc.account_name}`);
    console.log(`   Account ID: ${acc.id}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id || 'NOT SET'}`);
    console.log(`   Status: ${acc.connection_status}`);
    console.log(`   Active: ${acc.is_active}`);
    console.log('');
  });
} else {
  console.log('❌ NO ACCOUNTS CONFIGURED\n');
  console.log('⚠️  This workspace needs a LinkedIn account connected!');
  console.log('   1. Go to workspace settings');
  console.log('   2. Connect LinkedIn via Unipile');
  console.log('   3. Retry campaign\n');
}
