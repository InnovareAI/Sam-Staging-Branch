#!/usr/bin/env node

/**
 * Airtable Restore Script
 * Restores critical database tables from Airtable backup
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function restoreFromAirtable(restorePointName) {
  console.log('🔄 Restoring from Airtable...');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Restore Point: ${restorePointName}`);
  console.log('');

  // Check for Airtable credentials
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.log('❌ Airtable not configured!');
    console.log('');
    console.log('Please add to .env.local:');
    console.log('   AIRTABLE_API_KEY=key...');
    console.log('   AIRTABLE_BASE_ID=app...');
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

    let totalRestored = 0;

    // Restore workspace_accounts
    console.log('📁 Restoring workspace_accounts...');
    const accountRecords = await base('Workspace Accounts')
      .select({
        filterByFormula: `{Restore Point} = "${restorePointName}"`
      })
      .all();

    if (accountRecords.length > 0) {
      for (const record of accountRecords) {
        const fields = record.fields;
        await supabase
          .from('workspace_accounts')
          .upsert({
            id: fields['Supabase ID'],
            workspace_id: fields['Workspace ID'],
            user_id: fields['User ID'],
            account_type: fields['Account Type'],
            account_name: fields['Account Name'],
            account_identifier: fields['Account Name'],
            unipile_account_id: fields['Unipile Account ID'],
            connection_status: fields['Connection Status'],
            is_active: fields['Is Active'] === 'Yes',
            updated_at: new Date().toISOString()
          });
      }
      console.log(`   ✅ Restored ${accountRecords.length} workspace accounts`);
      totalRestored += accountRecords.length;
    }

    // Restore workspace_members
    console.log('👥 Restoring workspace_members...');
    const memberRecords = await base('Workspace Members')
      .select({
        filterByFormula: `{Restore Point} = "${restorePointName}"`
      })
      .all();

    if (memberRecords.length > 0) {
      for (const record of memberRecords) {
        const fields = record.fields;
        await supabase
          .from('workspace_members')
          .upsert({
            id: fields['Supabase ID'],
            workspace_id: fields['Workspace ID'],
            user_id: fields['User ID'],
            role: fields['Role'],
            status: fields['Status'],
            joined_at: fields['Joined At']
          });
      }
      console.log(`   ✅ Restored ${memberRecords.length} workspace members`);
      totalRestored += memberRecords.length;
    }

    // Restore users
    console.log('👤 Restoring users...');
    const userRecords = await base('Users')
      .select({
        filterByFormula: `{Restore Point} = "${restorePointName}"`
      })
      .all();

    if (userRecords.length > 0) {
      for (const record of userRecords) {
        const fields = record.fields;
        await supabase
          .from('users')
          .upsert({
            id: fields['Supabase ID'],
            email: fields['Email'],
            first_name: fields['First Name'],
            last_name: fields['Last Name'],
            current_workspace_id: fields['Current Workspace'],
            email_verified: fields['Email Verified'] === 'Yes',
            updated_at: new Date().toISOString()
          });
      }
      console.log(`   ✅ Restored ${userRecords.length} users`);
      totalRestored += userRecords.length;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Airtable Restore Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Total records restored: ${totalRestored}`);
    console.log('');

  } catch (error) {
    console.error('❌ Airtable restore failed:', error.message);
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  const restorePointName = process.argv[2];

  if (!restorePointName) {
    console.log('Usage: node restore-from-airtable.cjs "restore-point-name"');
    console.log('');
    console.log('Example:');
    console.log('  node restore-from-airtable.cjs "Restore point: Before big refactor"');
    console.log('');
    process.exit(1);
  }

  restoreFromAirtable(restorePointName).then(() => process.exit(0));
}

module.exports = { restoreFromAirtable };
