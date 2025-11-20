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

console.log('\n📊 All InnovareAI Workspaces:\n');

const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name, slug')
  .or('name.ilike.%IA%,slug.ilike.%ia%')
  .order('name');

for (const workspace of workspaces) {
  console.log(`${workspace.name} (${workspace.slug})`);
  console.log(`   ID: ${workspace.id}`);
  
  // Get LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('account_name, unipile_account_id, connection_status')
    .eq('workspace_id', workspace.id)
    .eq('account_type', 'linkedin');
  
  if (accounts && accounts.length > 0) {
    accounts.forEach(a => {
      const status = a.connection_status === 'connected' ? '✅' : '❌';
      console.log(`   ${status} LinkedIn: ${a.account_name} (${a.unipile_account_id})`);
    });
  } else {
    console.log(`   LinkedIn: (none)`);
  }
  
  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', workspace.id);
  
  console.log(`   Campaigns: ${campaigns?.length || 0}`);
  if (campaigns && campaigns.length > 0 && campaigns.length <= 3) {
    campaigns.forEach(c => console.log(`     - ${c.name}`));
  }
  
  console.log();
}
