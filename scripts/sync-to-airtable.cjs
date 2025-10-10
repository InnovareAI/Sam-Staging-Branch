#!/usr/bin/env node

/**
 * Airtable Sync Script
 * Mirrors Supabase data to Airtable (exact copy, not append)
 * Clears Airtable tables and repopulates with current Supabase data
 */

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function syncToAirtable(description = 'Sync from Supabase') {
  console.log('🔄 Syncing Supabase to Airtable (mirror mode)...');
  console.log('='.repeat(60));
  console.log('');

  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.log('⚠️  Airtable not configured');
    return;
  }

  try {
    const Airtable = require('airtable');
    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = airtable.base(process.env.AIRTABLE_BASE_ID);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const timestamp = new Date().toISOString();

    // Step 1: Clear existing records from all data tables
    console.log('🗑️  Clearing existing Airtable records...');

    const tables = [
      'Workspace Accounts',
      'Workspace Members',
      'Users',
      'Workspaces'
    ];

    for (const tableName of tables) {
      const records = await base(tableName).select().all();
      if (records.length > 0) {
        const recordIds = records.map(r => r.id);
        // Delete in batches of 10 (Airtable limit)
        for (let i = 0; i < recordIds.length; i += 10) {
          const batch = recordIds.slice(i, i + 10);
          await base(tableName).destroy(batch);
        }
        console.log(`   ✅ Cleared ${records.length} records from ${tableName}`);
      } else {
        console.log(`   ⚪ ${tableName} was already empty`);
      }
    }
    console.log('');

    // Step 2: Populate with current Supabase data
    console.log('📥 Syncing current Supabase data...');
    console.log('');
    let totalRecords = 0;

    // Sync workspace_accounts
    console.log('📁 Syncing workspace_accounts...');
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*');

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        await base('Workspace Accounts').create({
          'Supabase ID': account.id,
          'Workspace ID': account.workspace_id,
          'User ID': account.user_id,
          'Account Type': account.account_type || 'unknown',
          'Account Name': account.account_name || account.account_identifier,
          'Unipile Account ID': account.unipile_account_id || '',
          'Connection Status': account.connection_status || 'unknown',
          'Is Active': account.is_active ? 'Yes' : 'No',
          'Backup Timestamp': timestamp,
          'Restore Point': description
        }, { typecast: true });
      }
      console.log(`   ✅ Synced ${accounts.length} workspace accounts`);
      totalRecords += accounts.length;
    }

    // Sync workspace_members
    console.log('👥 Syncing workspace_members...');
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*');

    if (members && members.length > 0) {
      for (const member of members) {
        await base('Workspace Members').create({
          'Supabase ID': member.id,
          'Workspace ID': member.workspace_id,
          'User ID': member.user_id,
          'Role': member.role || 'member',
          'Status': member.status || 'active',
          'Joined At': member.joined_at,
          'Backup Timestamp': timestamp,
          'Restore Point': description
        }, { typecast: true });
      }
      console.log(`   ✅ Synced ${members.length} workspace members`);
      totalRecords += members.length;
    }

    // Sync users
    console.log('👤 Syncing users...');
    const { data: users } = await supabase
      .from('users')
      .select('*');

    if (users && users.length > 0) {
      for (const user of users) {
        await base('Users').create({
          'Supabase ID': user.id,
          'Email': user.email,
          'First Name': user.first_name || '',
          'Last Name': user.last_name || '',
          'Current Workspace': user.current_workspace_id || '',
          'Email Verified': user.email_verified ? 'Yes' : 'No',
          'Created At': user.created_at,
          'Backup Timestamp': timestamp,
          'Restore Point': description
        });
      }
      console.log(`   ✅ Synced ${users.length} users`);
      totalRecords += users.length;
    }

    // Sync workspaces
    console.log('🏢 Syncing workspaces...');
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('*');

    if (workspaces && workspaces.length > 0) {
      for (const workspace of workspaces) {
        await base('Workspaces').create({
          'Supabase ID': workspace.id,
          'Workspace Name': workspace.name || 'Unnamed',
          'Client Code': workspace.client_code || '',
          'Reseller': workspace.tenant === '3cubed' ? '3cubed' : 'InnovareAI',
          'Owner ID': workspace.owner_id || '',
          'Status': workspace.is_active ? 'active' : 'inactive',
          'Created At': workspace.created_at,
          'Backup Timestamp': timestamp
        }, { typecast: true });
      }
      console.log(`   ✅ Synced ${workspaces.length} workspaces`);
      totalRecords += workspaces.length;
    }

    // Record sync metadata
    await base('Backup Metadata').create({
      'Timestamp': timestamp,
      'Restore Point Name': description,
      'Tables Backed Up': 'workspace_accounts, workspace_members, users, workspaces',
      'Record Count': totalRecords,
      'Status': 'Complete',
      'Backup Type': 'Manual'
    }, { typecast: true });

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Airtable Sync Complete (Mirror Mode)');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Total records synced: ${totalRecords}`);
    console.log(`Description: ${description}`);
    console.log('');
    console.log('🔗 Airtable now mirrors Supabase exactly');
    console.log(`   View: https://airtable.com/${process.env.AIRTABLE_BASE_ID}`);
    console.log('');

  } catch (error) {
    console.error('❌ Airtable sync failed:', error.message);
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  const description = process.argv[2] || `Mirror sync ${new Date().toISOString()}`;
  syncToAirtable(description).then(() => process.exit(0));
}

module.exports = { syncToAirtable };
