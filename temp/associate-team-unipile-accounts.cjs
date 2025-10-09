require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function associateUnipileAccounts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔧 Associating Unipile Accounts to Team Members');
  console.log('='.repeat(60));
  console.log('');

  // Get Jennifer's user ID
  const { data: jenniferUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'jf@innovareai.com')
    .single();

  // Get Irish's user ID
  const { data: irishUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'im@innovareai.com')
    .single();

  if (!jenniferUser || !irishUser) {
    console.log('❌ Could not find users');
    return;
  }

  console.log('✅ Users found:');
  console.log('   Jennifer Fleming:', jenniferUser.id);
  console.log('   Irish Maguad:', irishUser.id);
  console.log('');

  // Re-associate Jennifer's email account (jf@innovareai.com)
  console.log('1️⃣ Re-associating Jennifer\'s email account...');
  const { data: jfEmail, error: jfEmailError } = await supabase
    .from('workspace_accounts')
    .update({ user_id: jenniferUser.id })
    .eq('workspace_id', WORKSPACE_ID)
    .eq('unipile_account_id', 'eXWYctjDQHOSNMxVxbdcHA')
    .select();

  if (jfEmailError) {
    console.log('   ❌ Error:', jfEmailError.message);
  } else if (jfEmail && jfEmail.length > 0) {
    console.log('   ✅ Email account re-associated!');
    console.log('      Account:', jfEmail[0].account_identifier);
  } else {
    console.log('   ⚠️  Account not found');
  }
  console.log('');

  // Re-associate Irish's LinkedIn account (Irish Maguad)
  console.log('2️⃣ Re-associating Irish\'s LinkedIn account...');
  const { data: imLinkedIn, error: imLinkedInError } = await supabase
    .from('workspace_accounts')
    .update({ user_id: irishUser.id })
    .eq('workspace_id', WORKSPACE_ID)
    .eq('unipile_account_id', 'avp6xHsCRZaP5uSPmjc2jg')
    .select();

  if (imLinkedInError) {
    console.log('   ❌ Error:', imLinkedInError.message);
  } else if (imLinkedIn && imLinkedIn.length > 0) {
    console.log('   ✅ LinkedIn account re-associated!');
    console.log('      Account:', imLinkedIn[0].account_identifier);
  } else {
    console.log('   ⚠️  Account not found');
  }
  console.log('');

  // Verify final state
  console.log('3️⃣ Final verification...');

  const { data: jfAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_type, account_identifier')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', jenniferUser.id);

  const { data: imAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_type, account_identifier')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', irishUser.id);

  console.log('');
  console.log('✅ Jennifer Fleming accounts:', jfAccounts?.length || 0);
  if (jfAccounts && jfAccounts.length > 0) {
    jfAccounts.forEach(acc => {
      console.log(`   - ${acc.account_type}: ${acc.account_identifier}`);
    });
  }
  console.log('');

  console.log('✅ Irish Maguad accounts:', imAccounts?.length || 0);
  if (imAccounts && imAccounts.length > 0) {
    imAccounts.forEach(acc => {
      console.log(`   - ${acc.account_type}: ${acc.account_identifier}`);
    });
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('🎉 Account association complete!');
  console.log('');
}

associateUnipileAccounts().then(() => process.exit(0));
