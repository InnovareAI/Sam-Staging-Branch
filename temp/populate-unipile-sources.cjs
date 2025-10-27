#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function populateUnipileSources() {
  console.log('🔄 Populating unipile_sources for all workspace_accounts...\n');

  // Get all LinkedIn accounts from Unipile
  const unipileDSN = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  const allAccountsUrl = `https://${unipileDSN}/api/v1/accounts`;

  console.log(`📡 Fetching accounts from Unipile...`);
  const response = await fetch(allAccountsUrl, {
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch from Unipile: ${response.status}`);
    return;
  }

  const allAccountsData = await response.json();
  const allAccounts = Array.isArray(allAccountsData) ? allAccountsData : (allAccountsData.items || allAccountsData.accounts || []);

  const linkedInAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN');
  console.log(`📊 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile\n`);

  // Get all workspace_accounts
  const { data: workspaceAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('account_type', 'linkedin');

  console.log(`💾 Found ${workspaceAccounts?.length || 0} LinkedIn accounts in workspace_accounts\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Update each workspace account with its sources
  for (const workspaceAccount of workspaceAccounts || []) {
    const unipileAccount = linkedInAccounts.find(acc => acc.id === workspaceAccount.unipile_account_id);

    if (!unipileAccount) {
      console.log(`⚠️  Account ${workspaceAccount.account_name} (${workspaceAccount.unipile_account_id}) not found in Unipile`);
      skippedCount++;
      continue;
    }

    const sources = unipileAccount.sources || [];
    const activeSources = sources.filter(s => s.status === 'OK' || s.status === 'ACTIVE' || s.status === 'CONNECTED');

    console.log(`\n📝 ${workspaceAccount.account_name} (${workspaceAccount.unipile_account_id}):`);
    console.log(`   Total sources: ${sources.length}`);
    console.log(`   Active sources: ${activeSources.length}`);

    if (activeSources.length > 0) {
      console.log(`   ✅ Active source ID: ${activeSources[0].id}`);
      console.log(`      Status: ${activeSources[0].status}`);
    }

    // Update the workspace account
    const { error: updateError } = await supabase
      .from('workspace_accounts')
      .update({
        unipile_sources: sources,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceAccount.id);

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      errorCount++;
    } else {
      console.log(`   ✅ Updated successfully`);
      updatedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ⚠️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

populateUnipileSources().catch(console.error);
