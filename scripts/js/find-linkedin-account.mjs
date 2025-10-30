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

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af';

async function findAccount() {
  // Get campaign workspace
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('workspace_id, name')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log('Campaign:', campaign.name);
  console.log('Workspace ID:', campaign.workspace_id);
  console.log();

  // Check ALL workspace_accounts
  const { data: allAccounts } = await supabase
    .from('workspace_accounts')
    .select('*');

  console.log(`Total accounts in database: ${allAccounts?.length || 0}`);
  console.log();

  // Check for this workspace specifically
  const { data: workspaceAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id);

  console.log(`Accounts for campaign workspace: ${workspaceAccounts?.length || 0}`);
  
  if (workspaceAccounts && workspaceAccounts.length > 0) {
    workspaceAccounts.forEach(acc => {
      console.log('\n✅ Found account:');
      console.log('   Provider:', acc.provider);
      console.log('   Name:', acc.account_name);
      console.log('   Status:', acc.status);
      console.log('   Unipile ID:', acc.unipile_account_id);
      console.log('   Created:', new Date(acc.created_at).toLocaleString());
    });
  }

  // Also check workspace_settings for Unipile config
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', campaign.workspace_id)
    .single();

  console.log('\nWorkspace settings:');
  console.log('   Name:', workspace.name);
  console.log('   Integrations:', JSON.stringify(workspace.integrations || {}, null, 2));
}

findAccount();
