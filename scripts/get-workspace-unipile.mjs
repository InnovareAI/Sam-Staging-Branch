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

const workspaceId = '04666209-fce8-4d71-8eaf-01278edfc73b';

const { data: accounts } = await supabase
  .from('unipile_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('provider', 'LINKEDIN')
  .limit(5);

console.log('\n🔗 LinkedIn accounts for this workspace:\n');

for (const account of accounts) {
  console.log(`Account: ${account.account_identifier || account.account_id}`);
  console.log(`  Unipile ID: ${account.account_id}`);
  console.log(`  Status: ${account.connection_status}`);
  console.log(`  Owner: ${account.workspace_id}\n`);
}
