require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkTLEmail() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 Checking email accounts for tl@innovareai.com...');
  console.log('');

  // Get user ID first
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'tl@innovareai.com')
    .single();

  if (!user) {
    console.log('❌ User tl@innovareai.com not found');
    return;
  }

  console.log('✅ User found:', user.email, `(${user.id})`);
  console.log('');

  // Get email accounts
  const { data: emailAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('account_type', 'email');

  if (!emailAccounts || emailAccounts.length === 0) {
    console.log('❌ No email accounts found for tl@innovareai.com');
    console.log('');
    console.log('Expected: tl@innovareai.com should have an email account');
    console.log('Unipile has: nefy7jYjS5K6X3U7ORxHNQ');
    return;
  }

  console.log('✅ Email accounts found:', emailAccounts.length);
  console.log('');

  emailAccounts.forEach((acc, i) => {
    console.log(`${i + 1}. Account: ${acc.account_name || acc.account_identifier}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id}`);
    console.log(`   Status: ${acc.connection_status}`);
    console.log(`   Active: ${acc.is_active}`);
    console.log('');
  });
}

checkTLEmail().then(() => process.exit(0));
