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

console.log('🔍 Checking Michelle\'s Unipile Account\n');

const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

// Get campaign with workspace accounts
const { data: campaign, error } = await supabase
  .from('campaigns')
  .select(`
    *,
    workspace:workspaces (
      id,
      name
    )
  `)
  .eq('id', CAMPAIGN_ID)
  .single();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('Campaign:', campaign.name);
console.log('Workspace:', campaign.workspace.name);
console.log('Workspace ID:', campaign.workspace_id);
console.log('');

// Get workspace accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id);

console.log(`Found ${accounts.length} workspace accounts:\n`);

accounts.forEach((acc, i) => {
  console.log(`${i + 1}. Account Name: ${acc.account_name}`);
  console.log(`   Unipile ID: ${acc.unipile_account_id}`);
  console.log(`   Provider: ${acc.provider}`);
  console.log(`   Active: ${acc.is_active}`);
  console.log('');
});
