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

async function checkCreatorAccount() {
  console.log('🔍 Checking campaign creator LinkedIn account\n');

  // Get campaign and creator
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, created_by, workspace_id')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log('Campaign:', campaign.name);
  console.log('Created by user ID:', campaign.created_by);
  console.log();

  // Get creator's LinkedIn account
  const { data: linkedinAccount, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (error || !linkedinAccount) {
    console.log('❌ Campaign creator does NOT have a LinkedIn account');
    console.log('   Error:', error?.message || 'No account found');
    console.log();

    // Show all LinkedIn accounts in workspace
    const { data: allAccounts } = await supabase
      .from('workspace_accounts')
      .select('user_id, account_name, account_type')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'linkedin');

    console.log('Available LinkedIn accounts in workspace:');
    allAccounts?.forEach(acc => {
      console.log(`  - ${acc.account_name} (user: ${acc.user_id})`);
    });

    console.log('\n💡 Solution: Update campaign.created_by to match a user with LinkedIn');
  } else {
    console.log('✅ Found campaign creator LinkedIn account:');
    console.log('   Name:', linkedinAccount.account_name);
    console.log('   Unipile ID:', linkedinAccount.unipile_account_id);
    console.log('   Status:', linkedinAccount.connection_status);
    console.log('\n✅ Campaign should be able to execute!');
  }
}

checkCreatorAccount();
