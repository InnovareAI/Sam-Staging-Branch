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

console.log('🔍 Checking Charissa\'s Campaigns\n');

// Find Charissa's workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%charissa%');

console.log(`Found ${workspaces.length} workspaces:\n`);
workspaces.forEach(w => console.log(`  - ${w.name} (${w.id})`));

if (workspaces.length === 0) {
  console.log('\n❌ No workspaces found for Charissa\n');
  process.exit(0);
}

const workspaceId = workspaces[0].id;
console.log(`\nUsing workspace: ${workspaces[0].name}\n`);

// Get campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, campaign_type, created_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });

console.log(`Campaigns (${campaigns.length} total):\n`);

campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Type: ${c.campaign_type}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}`);
  console.log('');
});

// Get prospect status summary
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('status, campaign_id')
  .in('campaign_id', campaigns.map(c => c.id));

const statusByStatus = {};
prospects.forEach(p => {
  statusByStatus[p.status] = (statusByStatus[p.status] || 0) + 1;
});

console.log('Prospect Status Summary:');
Object.entries(statusByStatus).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');

// Check Unipile account
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId);

console.log(`Unipile Accounts (${accounts.length} total):\n`);
accounts.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name}`);
  console.log(`   Unipile ID: ${acc.unipile_account_id}`);
  console.log(`   Provider: ${acc.provider || 'N/A'}`);
  console.log(`   Active: ${acc.is_active}`);
  console.log('');
});

// Verify Unipile account exists
if (accounts.length > 0) {
  const accountId = accounts[0].unipile_account_id;
  console.log(`Verifying Unipile account ${accountId}...\n`);
  
  const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts/${accountId}`, {
    headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY }
  });
  
  if (response.ok) {
    const account = await response.json();
    console.log('✅ Unipile account is valid');
    console.log(`   Name: ${account.name}`);
    console.log(`   Provider: ${account.provider}`);
  } else {
    console.log('❌ Unipile account NOT FOUND (404)');
    console.log('   Charissa needs to reconnect LinkedIn!\n');
  }
}
