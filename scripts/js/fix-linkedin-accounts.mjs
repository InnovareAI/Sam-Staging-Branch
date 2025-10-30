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

async function fixAccounts() {
  console.log('🔧 Fixing LinkedIn account metadata...\n');

  // Get all accounts with Unipile IDs but missing provider/status
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .not('unipile_account_id', 'is', null)
    .is('provider', null);

  console.log(`Found ${accounts?.length || 0} accounts to fix\n`);

  for (const account of accounts || []) {
    console.log(`Updating: ${account.account_name}`);
    
    const { error } = await supabase
      .from('workspace_accounts')
      .update({
        provider: 'linkedin',
        status: 'active'
      })
      .eq('id', account.id);

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Updated`);
    }
  }

  console.log('\n✅ All accounts updated!');
}

fixAccounts();
