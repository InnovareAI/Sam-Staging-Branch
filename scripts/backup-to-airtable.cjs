#!/usr/bin/env node

/**
 * Airtable Backup Script
 * Backs up critical database tables to Airtable for visual verification and secondary safety
 */

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function backupToAirtable(restorePointName) {
  console.log('🔄 Backing up to Airtable...');
  console.log('='.repeat(60));
  console.log('');

  // Check for Airtable credentials
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.log('⚠️  Airtable not configured yet!');
    console.log('');
    console.log('To enable Airtable backups:');
    console.log('');
    console.log('1. Create Airtable account: https://airtable.com/signup');
    console.log('2. Create base: "SAM-Backups"');
    console.log('3. Get API key: https://airtable.com/account');
    console.log('4. Add to .env.local:');
    console.log('   AIRTABLE_API_KEY=key...');
    console.log('   AIRTABLE_BASE_ID=app...');
    console.log('');
    console.log('5. Install Airtable SDK:');
    console.log('   npm install airtable');
    console.log('');
    console.log('For now, backup saved to Supabase Pro only.');
    console.log('');
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
    let totalRecords = 0;

    // Backup workspace_accounts (CRITICAL)
    console.log('📁 Backing up workspace_accounts...');
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
          'Restore Point': restorePointName
        }, { typecast: true }); // typecast allows flexibility with select fields
      }
      console.log(`   ✅ Backed up ${accounts.length} workspace accounts`);
      totalRecords += accounts.length;
    }

    // Backup workspace_members (CRITICAL)
    console.log('👥 Backing up workspace_members...');
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
          'Restore Point': restorePointName
        }, { typecast: true });
      }
      console.log(`   ✅ Backed up ${members.length} workspace members`);
      totalRecords += members.length;
    }

    // Backup users (CRITICAL)
    console.log('👤 Backing up users...');
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
          'Restore Point': restorePointName
        });
      }
      console.log(`   ✅ Backed up ${users.length} users`);
      totalRecords += users.length;
    }

    // Record backup metadata
    await base('Backup Metadata').create({
      'Timestamp': timestamp,
      'Restore Point Name': restorePointName,
      'Tables Backed Up': 'workspace_accounts, workspace_members, users',
      'Record Count': totalRecords,
      'Status': 'Complete',
      'Backup Type': 'Automatic with restore-point'
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Airtable Backup Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Total records backed up: ${totalRecords}`);
    console.log(`Restore point: ${restorePointName}`);
    console.log('');
    console.log('View in Airtable:');
    console.log(`https://airtable.com/${process.env.AIRTABLE_BASE_ID}`);
    console.log('');

  } catch (error) {
    console.error('❌ Airtable backup failed:', error.message);
    console.log('');
    console.log('⚠️  Continuing with Supabase Pro backup only.');
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  const restorePointName = process.argv[2] || `Manual backup ${new Date().toISOString()}`;
  backupToAirtable(restorePointName).then(() => process.exit(0));
}

module.exports = { backupToAirtable };
