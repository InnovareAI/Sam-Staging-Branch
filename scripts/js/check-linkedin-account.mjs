#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed

console.log('🔍 Checking LinkedIn accounts for 3cubed workspace...\n');

// Check workspace_accounts table
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId);

console.log(`Found ${accounts?.length || 0} accounts in workspace_accounts:\n`);

accounts?.forEach(a => {
  console.log(`Provider: ${a.provider}`);
  console.log(`Account ID: ${a.account_id}`);
  console.log(`Unipile ID: ${a.unipile_account_id || 'N/A'}`);
  console.log(`Status: ${a.status || 'active'}`);
  console.log();
});

// If no accounts, check campaign creator's personal accounts
const { data: campaign } = await supabase
  .from('campaigns')
  .select('created_by')
  .eq('id', '51803ded-bbc9-4564-aefb-c6d11d69f17c')
  .single();

if (campaign?.created_by) {
  console.log(`\nChecking campaign creator's accounts (user_id: ${campaign.created_by})...\n`);
  
  // Try different possible account storage locations
  const { data: userAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', campaign.created_by);
  
  console.log(`Found ${userAccounts?.length || 0} user-linked accounts\n`);
  
  userAccounts?.forEach(a => {
    console.log(`Provider: ${a.provider}`);
    console.log(`Unipile ID: ${a.unipile_account_id || 'N/A'}`);
    console.log();
  });
}
