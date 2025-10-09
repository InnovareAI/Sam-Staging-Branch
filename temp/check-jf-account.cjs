require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkJF() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const EMAIL = 'jf@innovareai.com';

  console.log('🔍 Checking Jennifer Fleming (jf@innovareai.com)');
  console.log('='.repeat(60));
  console.log('');

  // 1. Check if user exists
  console.log('1️⃣ Checking users table...');
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', EMAIL)
    .single();

  if (userError || !user) {
    console.log('   ❌ User account does NOT exist in users table');
    console.log('');
  } else {
    console.log('   ✅ User exists!');
    console.log('      User ID:', user.id);
    console.log('      Email:', user.email);
    console.log('      Current Workspace:', user.current_workspace_id || 'None');
    console.log('');

    // Check workspace membership
    console.log('2️⃣ Checking workspace membership...');
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('user_id', user.id);

    if (!membership || membership.length === 0) {
      console.log('   ❌ NOT a member of InnovareAI workspace');
      console.log('');
    } else {
      console.log('   ✅ IS a member!');
      console.log('      Role:', membership[0].role);
      console.log('');
    }
  }

  // 3. Check if email account exists in workspace_accounts
  console.log('3️⃣ Checking email account in workspace_accounts...');
  const { data: emailAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('account_type', 'email')
    .ilike('account_identifier', '%jf@%');

  if (!emailAccounts || emailAccounts.length === 0) {
    console.log('   ❌ No email account found');
  } else {
    console.log('   ✅ Email account exists!');
    emailAccounts.forEach(acc => {
      console.log('      Account:', acc.account_identifier);
      console.log('      Unipile ID:', acc.unipile_account_id);
      console.log('      User ID:', acc.user_id);
      console.log('      Status:', acc.connection_status);
    });
  }
  console.log('');

  // 4. Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('');
  if (!user) {
    console.log('❌ Jennifer Fleming needs:');
    console.log('   1. User account created in users table');
    console.log('   2. Workspace membership in InnovareAI');
    console.log('   3. Email account re-associated to her user ID');
  } else if (!membership || membership.length === 0) {
    console.log('⚠️  Jennifer Fleming has user account but needs:');
    console.log('   1. Workspace membership in InnovareAI');
    console.log('   2. Email account re-associated to her user ID (if different)');
  } else {
    console.log('✅ Jennifer Fleming is fully set up!');
  }
}

checkJF().then(() => process.exit(0));
