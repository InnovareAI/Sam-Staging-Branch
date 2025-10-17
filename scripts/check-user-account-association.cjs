/**
 * Check if user's LinkedIn account is properly associated
 * Run with: node scripts/check-user-account-association.cjs <user_email>
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const userEmail = process.argv[2] || 'tvonlinz@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUserAccountAssociation() {
  try {
    console.log(`🔍 Checking LinkedIn account association for: ${userEmail}\n`);

    // Get user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', userEmail);

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ User not found with email:', userEmail);
      console.log('💡 Try checking auth.users table instead');

      // Try auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers.users.find(u => u.email === userEmail);

      if (authUser) {
        console.log('\n✅ Found user in auth.users:');
        console.log(`   User ID: ${authUser.id}`);
        console.log(`   Email: ${authUser.email}`);

        await checkAccounts(authUser.id);
      } else {
        console.log('❌ User not found in auth.users either');
      }
      return;
    }

    const user = users[0];
    console.log('✅ Found user:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}\n`);

    await checkAccounts(user.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkAccounts(userId) {
  // Check user_unipile_accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', userId);

  if (accountsError) {
    console.error('❌ Error fetching accounts:', accountsError);
    return;
  }

  console.log(`📊 LinkedIn Accounts Associated with User:\n`);

  if (!accounts || accounts.length === 0) {
    console.log('❌ NO LINKEDIN ACCOUNTS ASSOCIATED!\n');
    console.log('⚠️  This means the user CANNOT send campaigns!');
    console.log('\n📋 To fix this:');
    console.log('1. User needs to connect their LinkedIn account via Settings');
    console.log('2. OR manually insert into user_unipile_accounts table:');
    console.log('\nINSERT INTO user_unipile_accounts (');
    console.log('  user_id,');
    console.log('  unipile_account_id,');
    console.log('  platform,');
    console.log('  account_name,');
    console.log('  connection_status');
    console.log(') VALUES (');
    console.log(`  '${userId}',`);
    console.log(`  'mERQmojtSZq5GeomZZazlw', -- Thorsten Linz's Unipile account ID`);
    console.log(`  'LINKEDIN',`);
    console.log(`  'Thorsten Linz',`);
    console.log(`  'active'`);
    console.log(');');
    return;
  }

  console.log(`✅ Found ${accounts.length} account(s):\n`);

  accounts.forEach((account, index) => {
    console.log(`${index + 1}. ${account.account_name || 'Unnamed'}`);
    console.log(`   Unipile Account ID: ${account.unipile_account_id}`);
    console.log(`   Platform: ${account.platform}`);
    console.log(`   Status: ${account.connection_status}`);
    console.log(`   Created: ${account.created_at}`);
    console.log('');
  });

  console.log('✅ User can send campaigns from these account(s)!');
}

checkUserAccountAssociation();
