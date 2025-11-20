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

console.log('\n📊 InnovareAI Workspaces (IA1-IA7):\n');

for (let i = 1; i <= 7; i++) {
  const name = `IA${i}`;
  
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('name', name)
    .single();
  
  if (!workspace) {
    console.log(`${name}: ❌ Does not exist\n`);
    continue;
  }
  
  console.log(`${name}: ${workspace.id}`);
  
  // Get LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('account_name, unipile_account_id')
    .eq('workspace_id', workspace.id)
    .eq('account_type', 'linkedin');
  
  if (accounts && accounts.length > 0) {
    console.log(`   LinkedIn: ${accounts[0].account_name} (${accounts[0].unipile_account_id})`);
  } else {
    console.log(`   LinkedIn: (none)`);
  }
  
  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', workspace.id);
  
  console.log(`   Campaigns: ${campaigns?.length || 0}`);
  
  // Get members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspace.id);
  
  console.log(`   Members: ${members?.length || 0}\n`);
}
