#!/usr/bin/env node

/**
 * Manually trigger LinkedIn account sync for a specific user
 * This calls the same sync logic as the API endpoint
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error('❌ Missing Unipile credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncLinkedInAccounts(userEmail) {
  console.log(`\n🔄 Syncing LinkedIn accounts for user ${userEmail}`);
  console.log('━'.repeat(60));
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();
  
  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }
  
  console.log('✅ User found:', user.email);
  console.log('   Workspace ID:', user.current_workspace_id);
  
  if (!user.current_workspace_id) {
    console.error('❌ User has no current workspace');
    return;
  }
  
  // Fetch all LinkedIn accounts from Unipile
  const accountsUrl = UNIPILE_DSN.includes('.')
    ? `https://${UNIPILE_DSN}/api/v1/accounts`
    : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/accounts`;
  
  console.log('\n📡 Fetching accounts from Unipile...');
  const accountsResponse = await fetch(accountsUrl, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });
  
  if (!accountsResponse.ok) {
    console.error('❌ Failed to fetch Unipile accounts:', accountsResponse.status);
    return;
  }
  
  const allAccounts = await accountsResponse.json();
  const linkedinAccounts = allAccounts.items.filter(acc => acc.type === 'LINKEDIN');
  
  console.log(`📊 Found ${linkedinAccounts.length} LinkedIn accounts in Unipile`);
  
  // Get user's associated accounts from user_unipile_accounts
  const { data: userUnipileAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, platform')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');
  
  console.log(`👤 User has ${userUnipileAccounts?.length || 0} LinkedIn account(s) in user_unipile_accounts`);
  
  const userAccountIds = new Set(userUnipileAccounts?.map(a => a.unipile_account_id) || []);
  const userLinkedInAccounts = linkedinAccounts.filter(acc => userAccountIds.has(acc.id));
  
  console.log(`🔍 Matched ${userLinkedInAccounts.length} user account(s) in Unipile`);
  
  // Get current workspace_accounts for this user
  const { data: existingWorkspaceAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', user.current_workspace_id)
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');
  
  console.log(`💾 User has ${existingWorkspaceAccounts?.length || 0} LinkedIn account(s) in workspace_accounts`);
  
  const existingByUnipileId = new Map(
    existingWorkspaceAccounts?.map(acc => [acc.unipile_account_id, acc]) || []
  );
  
  const existingByEmail = new Map(
    existingWorkspaceAccounts?.map(acc => [acc.account_identifier, acc]) || []
  );
  
  let added = 0;
  let updated = 0;
  let deleted = 0;
  let errors = 0;
  
  // Add or update accounts
  for (const unipileAccount of userLinkedInAccounts) {
    try {
      const accountData = {
        workspace_id: user.current_workspace_id,
        user_id: user.id,
        account_type: 'linkedin',
        account_identifier: unipileAccount.identifier,
        unipile_account_id: unipileAccount.id,
        connection_status: 'connected',
        account_name: unipileAccount.display_name || unipileAccount.identifier
      };
      
      const existing = existingByUnipileId.get(unipileAccount.id);
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('workspace_accounts')
          .update({
            account_name: accountData.account_name,
            account_identifier: accountData.account_identifier,
            connection_status: accountData.connection_status
          })
          .eq('id', existing.id);
        
        if (error) {
          console.error(`❌ Failed to update account ${unipileAccount.id}:`, error);
          errors++;
        } else {
          console.log(`✅ Updated: ${accountData.account_identifier}`);
          updated++;
        }
      } else {
        // Check if there's an old record with the same email but different Unipile ID (reconnection case)
        const oldRecord = existingByEmail.get(unipileAccount.identifier);
        if (oldRecord) {
          console.log(`🔄 Detected reconnection for ${unipileAccount.identifier}`);
          console.log(`   Old Unipile ID: ${oldRecord.unipile_account_id}`);
          console.log(`   New Unipile ID: ${unipileAccount.id}`);
          
          // Delete old record
          const { error: deleteError } = await supabase
            .from('workspace_accounts')
            .delete()
            .eq('id', oldRecord.id);
          
          if (deleteError) {
            console.error(`❌ Failed to delete old record:`, deleteError);
            errors++;
            continue;
          }
          deleted++;
        }
        
        // Insert new record
        const { error } = await supabase
          .from('workspace_accounts')
          .insert(accountData);
        
        if (error) {
          console.error(`❌ Failed to upsert account ${unipileAccount.id}:`, error);
          errors++;
        } else {
          console.log(`✅ Added: ${accountData.account_identifier} (${unipileAccount.id})`);
          added++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing account ${unipileAccount.id}:`, error);
      errors++;
    }
  }
  
  // Delete stale accounts (exist in workspace_accounts but not in Unipile)
  const unipileAccountIds = new Set(userLinkedInAccounts.map(acc => acc.id));
  const staleAccounts = existingWorkspaceAccounts?.filter(
    acc => !unipileAccountIds.has(acc.unipile_account_id)
  ) || [];
  
  for (const stale of staleAccounts) {
    const { error } = await supabase
      .from('workspace_accounts')
      .delete()
      .eq('id', stale.id);
    
    if (error) {
      console.error(`❌ Failed to delete stale account ${stale.unipile_account_id}:`, error);
      errors++;
    } else {
      console.log(`🗑️  Deleted stale: ${stale.account_identifier}`);
      deleted++;
    }
  }
  
  console.log('\n━'.repeat(60));
  console.log('✅ Sync complete');
  console.log(`   Added: ${added}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Deleted: ${deleted}`);
  console.log(`   Errors: ${errors}`);
}

// Get email from command line or use default
const userEmail = process.argv[2] || 'tl@innovareai.com';

syncLinkedInAccounts(userEmail).catch(console.error);
