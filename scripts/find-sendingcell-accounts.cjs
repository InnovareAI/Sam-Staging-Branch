#!/usr/bin/env node
/**
 * Find SendingCell Email Accounts
 * User mentioned sending invitations for 2 Sendingcell email accounts
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function fetchUnipileAccount(accountId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UNIPILE_DSN?.split(':')[0],
      port: UNIPILE_DSN?.split(':')[1] || 443,
      path: `/api/v1/accounts/${accountId}`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function findMissingAccounts() {
  console.log('🔍 FINDING SENDINGCELL EMAIL ACCOUNTS\n');
  console.log('=' .repeat(80));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Look for SendingCell users
  const sendingcellEmails = [
    'jim.heim@sendingcell.com',
    'cathy.smith@sendingcell.com',
    'dave.stuteville@sendingcell.com'
  ];

  console.log('🔎 Checking SendingCell users...\n');

  for (const email of sendingcellEmails) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Checking: ${email}`);
    console.log('='.repeat(80));

    // Find user
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    if (!user) {
      console.log(`❌ User not found in auth.users`);
      continue;
    }

    console.log(`✅ User found: ${user.id}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);

    // Check workspace_accounts for THIS user
    const { data: wsAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id);

    console.log(`\n📊 workspace_accounts for ${email}:`);
    if (wsAccounts && wsAccounts.length > 0) {
      console.log(`   Found ${wsAccounts.length} accounts`);
      wsAccounts.forEach(acc => {
        console.log(`   - Type: ${acc.account_type}`);
        console.log(`     Identifier: ${acc.account_identifier}`);
        console.log(`     Unipile ID: ${acc.unipile_account_id}`);
        console.log(`     Status: ${acc.connection_status}`);
        console.log(`     Created: ${acc.created_at}\n`);
      });
    } else {
      console.log(`   ❌ NO workspace_accounts found for this user`);
    }

    // Check user_unipile_accounts for THIS user
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id);

    console.log(`\n📊 user_unipile_accounts for ${email}:`);
    if (userAccounts && userAccounts.length > 0) {
      console.log(`   Found ${userAccounts.length} accounts`);
      for (const acc of userAccounts) {
        console.log(`   - Platform: ${acc.platform}`);
        console.log(`     Unipile ID: ${acc.unipile_account_id}`);
        console.log(`     Status: ${acc.connection_status}`);
        console.log(`     Created: ${acc.created_at}`);

        // Fetch full details from Unipile
        try {
          const unipileData = await fetchUnipileAccount(acc.unipile_account_id);
          console.log(`     Unipile Type: ${unipileData.type}`);
          console.log(`     Unipile Status: ${unipileData.status}`);

          const accountEmail = unipileData.connection_params?.email ||
                              unipileData.connection_params?.mail?.username ||
                              unipileData.connection_params?.im?.email ||
                              'N/A';
          console.log(`     Account Email: ${accountEmail}`);
          console.log(`     Sources: ${JSON.stringify(unipileData.sources)}\n`);
        } catch (err) {
          console.log(`     ⚠️  Could not fetch from Unipile: ${err.message}\n`);
        }
      }
    } else {
      console.log(`   ❌ NO user_unipile_accounts found for this user`);
    }

    // Check current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    console.log(`\n🏢 User workspace: ${userProfile?.current_workspace_id || 'Not set'}`);
  }

  // Now check for GOOGLE_OAUTH accounts that might belong to SendingCell users
  console.log('\n\n' + '='.repeat(80));
  console.log('🔎 Checking ALL GOOGLE_OAUTH accounts in Unipile');
  console.log('='.repeat(80) + '\n');

  // We saw these GOOGLE_OAUTH accounts in user_unipile_accounts:
  const googleAccounts = [
    '-LxgrbhUTmmmFz4PEd_HLg', // User: f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)
    'nefy7jYjS5K6X3U7ORxHNQ', // User: f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)
    'zPhBXXI4RJGmItr_xh0h5A', // User: f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)
    '5x2r98fiTHe_81G5tIT6Mw'  // User: f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)
  ];

  for (const accountId of googleAccounts) {
    try {
      const unipileData = await fetchUnipileAccount(accountId);
      const accountEmail = unipileData.connection_params?.email ||
                          unipileData.connection_params?.mail?.username ||
                          'N/A';

      console.log(`Account ID: ${accountId}`);
      console.log(`  Email: ${accountEmail}`);
      console.log(`  Type: ${unipileData.type}`);
      console.log(`  Status: ${unipileData.status}`);
      console.log(`  Created: ${unipileData.created_at}`);
      console.log(`  Sources: ${JSON.stringify(unipileData.sources)}`);

      // Check if this is a SendingCell email
      if (accountEmail.includes('sendingcell')) {
        console.log(`  🎯 FOUND SENDINGCELL ACCOUNT!`);
      }
      console.log();
    } catch (err) {
      console.log(`Account ID: ${accountId}`);
      console.log(`  ⚠️  Error: ${err.message}\n`);
    }
  }
}

findMissingAccounts().catch(console.error);
