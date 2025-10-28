import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 COMPREHENSIVE WORKSPACE AUDIT\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Get ALL workspaces
console.log('📊 1. ALL WORKSPACES:\n');
const { data: workspaces, error: wsError } = await supabase
  .from('workspaces')
  .select('*')
  .order('name');

if (wsError) {
  console.log('❌ Error fetching workspaces:', wsError.message);
} else {
  console.log(`Found ${workspaces?.length || 0} workspaces\n`);
  for (const ws of workspaces || []) {
    console.log(`  ${ws.name}`);
    console.log(`    ID: ${ws.id}`);
    console.log(`    Client Code: ${ws.client_code || 'none'}`);
    console.log('');
  }
}

// 2. Get ALL workspace_accounts
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 2. ALL WORKSPACE ACCOUNTS:\n');
const { data: accounts, error: accError } = await supabase
  .from('workspace_accounts')
  .select('*')
  .order('workspace_id');

if (accError) {
  console.log('❌ Error fetching accounts:', accError.message);
} else {
  console.log(`Found ${accounts?.length || 0} accounts\n`);

  // Group by workspace
  const accountsByWorkspace = new Map();
  for (const acc of accounts || []) {
    if (!accountsByWorkspace.has(acc.workspace_id)) {
      accountsByWorkspace.set(acc.workspace_id, []);
    }
    accountsByWorkspace.get(acc.workspace_id).push(acc);
  }

  for (const ws of workspaces || []) {
    const wsAccounts = accountsByWorkspace.get(ws.id) || [];
    console.log(`  ${ws.name} (${ws.id}):`);
    if (wsAccounts.length === 0) {
      console.log('    ⚠️  NO ACCOUNTS');
    } else {
      for (const acc of wsAccounts) {
        console.log(`    ${acc.connection_status === 'connected' ? '✅' : '❌'} ${acc.account_type} - ${acc.account_name || 'unnamed'}`);
        console.log(`       Status: ${acc.connection_status}`);
        console.log(`       Unipile ID: ${acc.unipile_account_id || 'none'}`);
      }
    }
    console.log('');
  }
}

// 3. Test the EXACT query that's failing
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 3. TESTING QUERY THAT FAILS FOR INNOVAREAI:\n');

const innovareAiId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

// Test 1: Get all accounts for InnovareAI (no filters)
const { data: test1, error: err1 } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', innovareAiId);

console.log('Test 1: .eq(workspace_id) only');
console.log(`  Result: ${test1?.length || 0} accounts`);
if (err1) console.log(`  Error: ${err1.message}`);
for (const acc of test1 || []) {
  console.log(`    - ${acc.account_type} (${acc.connection_status})`);
}
console.log('');

// Test 2: Add account_type filter
const { data: test2, error: err2 } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', innovareAiId)
  .eq('account_type', 'linkedin');

console.log('Test 2: + .eq(account_type, linkedin)');
console.log(`  Result: ${test2?.length || 0} accounts`);
if (err2) console.log(`  Error: ${err2.message}`);
for (const acc of test2 || []) {
  console.log(`    - ${acc.account_name} (${acc.connection_status})`);
}
console.log('');

// Test 3: Add connection_status filter
const { data: test3, error: err3 } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', innovareAiId)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected');

console.log('Test 3: + .eq(connection_status, connected)');
console.log(`  Result: ${test3?.length || 0} accounts`);
if (err3) console.log(`  Error: ${err3.message}`);
for (const acc of test3 || []) {
  console.log(`    - ${acc.account_name} (Unipile: ${acc.unipile_account_id})`);
}
console.log('');

// Test 4: Try .single() on the result
const { data: test4, error: err4 } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id')
  .eq('workspace_id', innovareAiId)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

console.log('Test 4: Same query with .single()');
console.log(`  Result: ${test4 ? 'SUCCESS' : 'NULL'}`);
if (err4) console.log(`  Error: ${err4.message}`);
if (test4) console.log(`  Unipile ID: ${test4.unipile_account_id}`);
console.log('');

// 4. Get ALL campaigns
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 4. ALL CAMPAIGNS:\n');
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id, status, created_at')
  .order('created_at', { ascending: false });

console.log(`Found ${campaigns?.length || 0} campaigns\n`);

// Group by workspace
const campaignsByWorkspace = new Map();
for (const camp of campaigns || []) {
  if (!campaignsByWorkspace.has(camp.workspace_id)) {
    campaignsByWorkspace.set(camp.workspace_id, []);
  }
  campaignsByWorkspace.get(camp.workspace_id).push(camp);
}

for (const ws of workspaces || []) {
  const wsCampaigns = campaignsByWorkspace.get(ws.id) || [];
  if (wsCampaigns.length > 0) {
    console.log(`  ${ws.name}:`);
    for (const camp of wsCampaigns) {
      console.log(`    ${camp.status === 'active' ? '✅' : '⏸️ '} ${camp.name} (${camp.status})`);
    }
    console.log('');
  }
}

// 5. Check for orphaned campaigns
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 5. CHECKING FOR ORPHANED RECORDS:\n');

const workspaceIds = new Set(workspaces?.map(w => w.id) || []);
const orphanedCampaigns = campaigns?.filter(c => !workspaceIds.has(c.workspace_id)) || [];
const orphanedAccounts = accounts?.filter(a => !workspaceIds.has(a.workspace_id)) || [];

if (orphanedCampaigns.length > 0) {
  console.log(`⚠️  Found ${orphanedCampaigns.length} orphaned campaigns:`);
  for (const camp of orphanedCampaigns) {
    console.log(`  - ${camp.name} (workspace_id: ${camp.workspace_id})`);
  }
} else {
  console.log('✅ No orphaned campaigns');
}

if (orphanedAccounts.length > 0) {
  console.log(`⚠️  Found ${orphanedAccounts.length} orphaned accounts:`);
  for (const acc of orphanedAccounts) {
    console.log(`  - ${acc.account_name} (workspace_id: ${acc.workspace_id})`);
  }
} else {
  console.log('✅ No orphaned accounts');
}

// 6. Check campaigns without LinkedIn accounts
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 6. CAMPAIGNS WITHOUT LINKEDIN ACCOUNTS:\n');

const accountsByWsMap = new Map();
for (const acc of accounts || []) {
  if (acc.account_type === 'linkedin' && acc.connection_status === 'connected') {
    accountsByWsMap.set(acc.workspace_id, true);
  }
}

const campaignsWithoutAccounts = [];
for (const camp of campaigns || []) {
  if (camp.status === 'active' && !accountsByWsMap.has(camp.workspace_id)) {
    campaignsWithoutAccounts.push(camp);
  }
}

if (campaignsWithoutAccounts.length > 0) {
  console.log(`⚠️  Found ${campaignsWithoutAccounts.length} active campaigns without LinkedIn accounts:`);
  for (const camp of campaignsWithoutAccounts) {
    const ws = workspaces?.find(w => w.id === camp.workspace_id);
    console.log(`  - ${camp.name} (${ws?.name || 'unknown workspace'})`);
  }
} else {
  console.log('✅ All active campaigns have LinkedIn accounts');
}

// 7. Check for prospects with missing names
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 7. PROSPECTS WITH MISSING NAMES:\n');

const { data: missingNameProspects } = await supabase
  .from('campaign_prospects')
  .select('id, campaign_id, first_name, last_name, linkedin_url, campaigns(name, workspace_id)')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null);

console.log(`Found ${missingNameProspects?.length || 0} prospects with missing names\n`);

// Group by workspace
const missingByWorkspace = new Map();
for (const p of missingNameProspects || []) {
  const wsId = p.campaigns?.workspace_id;
  if (!missingByWorkspace.has(wsId)) {
    missingByWorkspace.set(wsId, []);
  }
  missingByWorkspace.get(wsId).push(p);
}

for (const ws of workspaces || []) {
  const missing = missingByWorkspace.get(ws.id) || [];
  if (missing.length > 0) {
    console.log(`  ${ws.name}: ${missing.length} prospects`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 AUDIT SUMMARY:\n');
console.log(`  Workspaces: ${workspaces?.length || 0}`);
console.log(`  Accounts: ${accounts?.length || 0}`);
console.log(`  Campaigns: ${campaigns?.length || 0}`);
console.log(`  Orphaned campaigns: ${orphanedCampaigns.length}`);
console.log(`  Orphaned accounts: ${orphanedAccounts.length}`);
console.log(`  Active campaigns without LinkedIn: ${campaignsWithoutAccounts.length}`);
console.log(`  Prospects with missing names: ${missingNameProspects?.length || 0}`);
console.log('');
