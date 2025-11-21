import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword(user) {
  // Generate temporary password
  const tempPassword = 'TempPass' + Math.random().toString(36).substring(2, 10) + '!';

  console.log('\n🔐 Resetting password...');

  // Update password using Supabase Admin API
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: tempPassword }
  );

  if (updateError) {
    console.error('❌ Error resetting password:', updateError);
    return;
  }

  console.log('\n✅ PASSWORD RESET SUCCESSFUL!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('📧 Email:', user.email);
  console.log('🔑 Temporary Password:', tempPassword);
  console.log('🔗 Login URL: https://app.meet-sam.com');
  console.log('═══════════════════════════════════════════════');
  console.log('\n⚠️  Irish should:');
  console.log('   1. Log in with this temporary password');
  console.log('   2. Go to Settings → Integrations');
  console.log('   3. Click "Reconnect LinkedIn"');
  console.log('   4. Change her password in Settings → Profile\n');
}

async function resetIrishPassword() {
  try {
    console.log('🔍 Finding Irish Maguad\'s account by Unipile ID...\n');

    // Find workspace account with Irish's Unipile ID
    const { data: account, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('account_name, user_id')
      .eq('unipile_account_id', 'ymtTx4xVQ6OVUFk83ctwtA')
      .single();

    if (accountError || !account) {
      console.error('Error finding account:', accountError);
      console.log('\nTrying to find by email instead...');

      // Try direct email search
      const irishEmail = 'irish@innovareai.com'; // Common pattern
      console.log(`Looking for: ${irishEmail}`);

      const { data: authUser } = await supabase.auth.admin.listUsers();
      const user = authUser?.users?.find(u => u.email?.toLowerCase().includes('irish'));

      if (!user) {
        console.log('\n❌ Could not find Irish\'s account');
        console.log('Please provide her email address.');
        return;
      }

      console.log(`\n✅ Found: ${user.email}`);
      const irishUser = { id: user.id, email: user.email };

      await resetPassword(irishUser);
      return;
    }

    console.log(`✅ Found account: ${account.account_name}`);
    console.log(`User ID: ${account.user_id}`);

    // Get user details from auth
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(account.user_id);

    if (authError || !authData.user) {
      console.error('Error getting auth user:', authError);
      return;
    }

    const irishUser = { id: authData.user.id, email: authData.user.email };
    console.log(`\n✅ Found: ${irishUser.email}`);

    await resetPassword(irishUser);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

resetIrishPassword();
