#!/usr/bin/env node
/**
 * CRITICAL INVESTIGATION: Missing Email Accounts
 * User sent invitations but accounts are not appearing
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function fetchUnipileAccounts() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UNIPILE_DSN?.split(':')[0],
      port: UNIPILE_DSN?.split(':')[1] || 443,
      path: '/api/v1/accounts',
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

async function investigate() {
  console.log('🔍 CRITICAL INVESTIGATION: Missing Email Accounts\n');
  console.log('=' .repeat(80));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
    console.error('❌ Missing Unipile credentials in .env.local');
    process.exit(1);
  }

  console.log('✅ Credentials loaded');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Unipile DSN: ${UNIPILE_DSN}\n`);
  console.log('=' .repeat(80));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // STEP 1: Check ALL accounts in Unipile (not filtered)
  console.log('\n📡 STEP 1: Checking Unipile API for ALL accounts');
  console.log('-'.repeat(80));

  try {
    const unipileData = await fetchUnipileAccounts();
    const accounts = unipileData.items || unipileData || [];

    console.log(`Total accounts in Unipile: ${accounts.length}\n`);

    if (accounts.length === 0) {
      console.log('⚠️  NO ACCOUNTS FOUND IN UNIPILE API');
      console.log('   This means the OAuth invitations failed to create accounts');
      console.log('   OR the callback was never processed\n');
    } else {
      console.log('Accounts by type:');
      const byType = {};
      accounts.forEach(acc => {
        const type = acc.type || 'UNKNOWN';
        byType[type] = (byType[type] || 0) + 1;
      });

      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      console.log('\nDetailed account list:');
      accounts.forEach((acc, idx) => {
        const email = acc.connection_params?.email ||
                     acc.connection_params?.im?.email ||
                     acc.connection_params?.mail?.username ||
                     'N/A';

        console.log(`\n${idx + 1}. Account ID: ${acc.id}`);
        console.log(`   Type: ${acc.type}`);
        console.log(`   Name: ${acc.name || 'N/A'}`);
        console.log(`   Email: ${email}`);
        console.log(`   Status: ${acc.status}`);
        console.log(`   Created: ${acc.created_at || 'N/A'}`);
        console.log(`   Sources: ${JSON.stringify(acc.sources || [])}`);
        console.log(`   Connection Params: ${JSON.stringify(acc.connection_params || {}, null, 2)}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to fetch from Unipile API:', error.message);
    console.error('   Full error:', error);
  }

  // STEP 2: Check workspace_accounts table
  console.log('\n\n📊 STEP 2: Checking workspace_accounts table');
  console.log('-'.repeat(80));

  try {
    const { data: wsAccounts, error: wsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (wsError) {
      console.error('❌ Database error:', wsError);
    } else {
      console.log(`Total accounts in workspace_accounts: ${wsAccounts?.length || 0}\n`);

      if (wsAccounts && wsAccounts.length > 0) {
        const emailAccounts = wsAccounts.filter(acc => acc.account_type === 'email');
        const linkedinAccounts = wsAccounts.filter(acc => acc.account_type === 'linkedin');

        console.log(`   Email accounts: ${emailAccounts.length}`);
        console.log(`   LinkedIn accounts: ${linkedinAccounts.length}`);

        console.log('\nAll accounts:');
        wsAccounts.forEach((acc, idx) => {
          console.log(`\n${idx + 1}. Workspace: ${acc.workspace_id}`);
          console.log(`   User: ${acc.user_id}`);
          console.log(`   Type: ${acc.account_type}`);
          console.log(`   Identifier: ${acc.account_identifier}`);
          console.log(`   Unipile ID: ${acc.unipile_account_id}`);
          console.log(`   Status: ${acc.connection_status}`);
          console.log(`   Created: ${acc.created_at}`);
          console.log(`   Metadata: ${JSON.stringify(acc.account_metadata, null, 2)}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to check workspace_accounts:', error.message);
  }

  // STEP 3: Check user_unipile_accounts table (LinkedIn-specific)
  console.log('\n\n📊 STEP 3: Checking user_unipile_accounts table');
  console.log('-'.repeat(80));

  try {
    const { data: userAccounts, error: userError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (userError) {
      console.error('❌ Database error:', userError);
    } else {
      console.log(`Total accounts in user_unipile_accounts: ${userAccounts?.length || 0}\n`);

      if (userAccounts && userAccounts.length > 0) {
        userAccounts.forEach((acc, idx) => {
          console.log(`\n${idx + 1}. User: ${acc.user_id}`);
          console.log(`   Platform: ${acc.platform}`);
          console.log(`   Email: ${acc.account_email}`);
          console.log(`   Unipile ID: ${acc.unipile_account_id}`);
          console.log(`   Status: ${acc.connection_status}`);
          console.log(`   Created: ${acc.created_at}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to check user_unipile_accounts:', error.message);
  }

  // STEP 4: Check all users
  console.log('\n\n👥 STEP 4: Checking all users in system');
  console.log('-'.repeat(80));

  try {
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Failed to list users:', usersError);
    } else {
      console.log(`Total users: ${users?.length || 0}\n`);

      users?.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.email} (${user.id})`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to check users:', error.message);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('🔍 ANALYSIS & ROOT CAUSE');
  console.log('='.repeat(80));
  console.log('\nBased on the data above, determine:');
  console.log('1. Are the 2 missing email accounts in Unipile API?');
  console.log('2. If yes, why are they not in workspace_accounts?');
  console.log('3. If no, where did the OAuth callback fail?');
  console.log('4. Check the OAuth callback logs for errors\n');
}

investigate().catch(console.error);
