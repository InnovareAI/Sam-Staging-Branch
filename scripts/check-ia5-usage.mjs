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

const IA5_ID = 'cd57981a-e63b-401c-bde1-ac71752c2293';

console.log('\n🔍 Checking IA5 usage...\n');

// Check campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', IA5_ID);

console.log(`Campaigns: ${campaigns?.length || 0}`);
if (campaigns && campaigns.length > 0) {
  campaigns.forEach(c => console.log(`  - ${c.name}`));
}
console.log();

// Check accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('account_name, account_type')
  .eq('workspace_id', IA5_ID);

console.log(`Accounts: ${accounts?.length || 0}`);
if (accounts && accounts.length > 0) {
  accounts.forEach(a => console.log(`  - ${a.account_name} (${a.account_type})`));
}
console.log();

// Check members
const { data: members } = await supabase
  .from('workspace_members')
  .select('role, users(email)')
  .eq('workspace_id', IA5_ID);

console.log(`Members: ${members?.length || 0}`);
if (members && members.length > 0) {
  members.forEach(m => console.log(`  - ${m.users?.email} (${m.role})`));
}
console.log();

if (!campaigns?.length && !accounts?.length) {
  console.log('✅ IA5 is EMPTY - safe to use for Tobias\n');
} else {
  console.log('⚠️  IA5 has existing data\n');
}
