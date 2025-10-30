#!/usr/bin/env node
/**
 * Find Michelle's LinkedIn account
 */

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

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function findMichelle() {
  console.log('🔍 Finding Michelle\'s LinkedIn account...\n');
  console.log('='.repeat(70));

  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');

  if (!accounts) {
    console.log('❌ No accounts found');
    return;
  }

  console.log(`\nFound ${accounts.length} connected LinkedIn accounts:\n`);

  accounts.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.account_name}`);
    console.log(`   Database ID: ${acc.id}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id}`);
    console.log(`   User ID: ${acc.user_id}`);
    console.log(`   Status: ${acc.connection_status}`);
    console.log('');
  });

  const michelle = accounts.find(acc =>
    acc.account_name && acc.account_name.toLowerCase().includes('michelle')
  );

  console.log('='.repeat(70));

  if (michelle) {
    console.log('\n✅ FOUND MICHELLE\'S ACCOUNT:');
    console.log('='.repeat(70));
    console.log(`   Name: ${michelle.account_name}`);
    console.log(`   Database ID: ${michelle.id}`);
    console.log(`   Unipile ID: ${michelle.unipile_account_id}`);
    console.log(`   User ID: ${michelle.user_id}`);
    console.log('='.repeat(70));
  } else {
    console.log('\n❌ Michelle\'s account not found in connected accounts');
    console.log('='.repeat(70));
  }
}

findMichelle().catch(console.error);
