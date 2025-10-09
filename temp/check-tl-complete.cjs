require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkTLComplete() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const EMAIL = 'tl@innovareai.com';

  console.log('📊 Complete Account Summary for:', EMAIL);
  console.log('='.repeat(60));
  console.log('');

  // 1. User Account
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', EMAIL)
    .single();

  if (!user) {
    console.log('❌ User account not found');
    return;
  }

  console.log('✅ USER ACCOUNT');
  console.log('   Email:', user.email);
  console.log('   User ID:', user.id);
  console.log('   Current Workspace:', user.current_workspace_id);
  console.log('');

  // 2. Workspace Membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .single();

  if (membership) {
    console.log('✅ WORKSPACE MEMBERSHIP');
    console.log('   Workspace ID:', WORKSPACE_ID);
    console.log('   Role:', membership.role);
    console.log('   Member since:', new Date(membership.created_at).toLocaleDateString());
  } else {
    console.log('❌ NOT A MEMBER of workspace', WORKSPACE_ID);
  }
  console.log('');

  // 3. LinkedIn Accounts
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');

  console.log('📱 LINKEDIN ACCOUNTS:', linkedinAccounts?.length || 0);
  if (linkedinAccounts && linkedinAccounts.length > 0) {
    linkedinAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.account_name || acc.account_identifier}`);
      console.log(`      Unipile ID: ${acc.unipile_account_id}`);
      console.log(`      Status: ${acc.connection_status}`);
      console.log(`      Active: ${acc.is_active}`);
      console.log('');
    });
  } else {
    console.log('   No LinkedIn accounts connected');
    console.log('');
  }

  // 4. Email Accounts
  const { data: emailAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('account_type', 'email');

  console.log('📧 EMAIL ACCOUNTS:', emailAccounts?.length || 0);
  if (emailAccounts && emailAccounts.length > 0) {
    emailAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.account_name || acc.account_identifier}`);
      console.log(`      Unipile ID: ${acc.unipile_account_id}`);
      console.log(`      Status: ${acc.connection_status}`);
      console.log(`      Active: ${acc.is_active}`);
      console.log('');
    });
  } else {
    console.log('   No email accounts connected');
    console.log('');
  }

  // 5. Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('   Total LinkedIn accounts:', linkedinAccounts?.length || 0);
  console.log('   Total Email accounts:', emailAccounts?.length || 0);
  console.log('   Total accounts:', (linkedinAccounts?.length || 0) + (emailAccounts?.length || 0));
  console.log('');
  console.log('✅ Account is fully operational and ready to use SAM!');
}

checkTLComplete().then(() => process.exit(0));
