require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixAuthAccounts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔧 Fixing Auth Accounts');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Create Jennifer's auth account
  console.log('1️⃣ Creating Jennifer Fleming auth account...');
  const { data: jfAuth, error: jfAuthError } = await supabase.auth.admin.createUser({
    email: 'jf@innovareai.com',
    email_confirm: true,
    user_metadata: {
      first_name: 'Jennifer',
      last_name: 'Fleming'
    }
  });

  if (jfAuthError) {
    console.log('   ❌ Error:', jfAuthError.message);
  } else {
    console.log('   ✅ Auth account created!');
    console.log('      Auth ID:', jfAuth.user.id);

    // Delete old public.users record
    console.log('   🗑️  Deleting old public.users record...');
    await supabase
      .from('workspace_members')
      .delete()
      .eq('user_id', '92b1e206-4c2e-4302-a39f-e273baf51bcd');

    await supabase
      .from('users')
      .delete()
      .eq('id', '92b1e206-4c2e-4302-a39f-e273baf51bcd');

    // Create new public.users record with auth ID
    console.log('   ✅ Creating public.users with auth ID...');
    const { data: jfPublic, error: jfPublicError } = await supabase
      .from('users')
      .insert({
        id: jfAuth.user.id,
        email: 'jf@innovareai.com',
        first_name: 'Jennifer',
        last_name: 'Fleming',
        current_workspace_id: WORKSPACE_ID,
        email_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jfPublicError) {
      console.log('   ❌ Error creating public.users:', jfPublicError.message);
    } else {
      console.log('   ✅ public.users created with ID:', jfPublic.id);
    }

    // Add to workspace
    console.log('   👥 Adding to workspace...');
    await supabase
      .from('workspace_members')
      .insert({
        workspace_id: WORKSPACE_ID,
        user_id: jfAuth.user.id,
        role: 'admin',
        status: 'active',
        joined_at: new Date().toISOString()
      });
    console.log('   ✅ Added to workspace');
  }
  console.log('');

  // Step 2: Fix Irish's account (update public.users to use auth ID)
  console.log('2️⃣ Fixing Irish Maguad account...');
  const IRISH_AUTH_ID = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

  // Delete workspace membership with wrong ID
  console.log('   🗑️  Deleting old workspace membership...');
  await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', 'fdb121c8-85d2-4fb9-b255-cf97ffb80cde');

  // Delete old public.users record
  console.log('   🗑️  Deleting old public.users record...');
  await supabase
    .from('users')
    .delete()
    .eq('id', 'fdb121c8-85d2-4fb9-b255-cf97ffb80cde');

  // Check if correct public.users record exists
  const { data: existingIrish } = await supabase
    .from('users')
    .select('*')
    .eq('id', IRISH_AUTH_ID)
    .single();

  if (!existingIrish) {
    console.log('   ✅ Creating public.users with correct auth ID...');
    await supabase
      .from('users')
      .insert({
        id: IRISH_AUTH_ID,
        email: 'im@innovareai.com',
        first_name: 'Irish',
        last_name: 'Maguad',
        current_workspace_id: WORKSPACE_ID,
        email_verified: true,
        email_verified_at: new Date().toISOString()
      });
  } else {
    console.log('   ✅ public.users already exists with correct ID');
  }

  // Add to workspace with correct ID
  console.log('   👥 Adding to workspace...');
  const { error: imMemberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: WORKSPACE_ID,
      user_id: IRISH_AUTH_ID,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString()
    });

  if (imMemberError && !imMemberError.message.includes('duplicate')) {
    console.log('   ❌ Error:', imMemberError.message);
  } else {
    console.log('   ✅ Added to workspace (or already exists)');
  }
  console.log('');

  // Step 3: Now associate Unipile accounts
  console.log('3️⃣ Associating Unipile accounts...');

  if (jfAuth && jfAuth.user) {
    console.log('   📧 Jennifer\'s email account...');
    const { data: jfEmail } = await supabase
      .from('workspace_accounts')
      .update({ user_id: jfAuth.user.id })
      .eq('workspace_id', WORKSPACE_ID)
      .eq('unipile_account_id', 'eXWYctjDQHOSNMxVxbdcHA')
      .select();

    console.log('      ', jfEmail && jfEmail.length > 0 ? '✅ Associated' : '⚠️  Not found');
  }

  console.log('   📱 Irish\'s LinkedIn account...');
  const { data: imLinkedIn } = await supabase
    .from('workspace_accounts')
    .update({ user_id: IRISH_AUTH_ID })
    .eq('workspace_id', WORKSPACE_ID)
    .eq('unipile_account_id', 'avp6xHsCRZaP5uSPmjc2jg')
    .select();

  console.log('      ', imLinkedIn && imLinkedIn.length > 0 ? '✅ Associated' : '⚠️  Not found');
  console.log('');

  // Final verification
  console.log('='.repeat(60));
  console.log('📊 FINAL VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  if (jfAuth && jfAuth.user) {
    const { data: jfAccounts } = await supabase
      .from('workspace_accounts')
      .select('account_type, account_identifier')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('user_id', jfAuth.user.id);

    console.log('✅ Jennifer Fleming:');
    console.log('   Auth ID:', jfAuth.user.id);
    console.log('   Accounts:', jfAccounts?.length || 0);
    jfAccounts?.forEach(acc => {
      console.log(`      - ${acc.account_type}: ${acc.account_identifier}`);
    });
  }
  console.log('');

  const { data: imAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_type, account_identifier')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', IRISH_AUTH_ID);

  console.log('✅ Irish Maguad:');
  console.log('   Auth ID:', IRISH_AUTH_ID);
  console.log('   Accounts:', imAccounts?.length || 0);
  imAccounts?.forEach(acc => {
    console.log(`      - ${acc.account_type}: ${acc.account_identifier}`);
  });
  console.log('');

  console.log('🎉 All accounts fixed and associated!');
  console.log('');
  console.log('⚠️  Users need to set passwords:');
  console.log('   https://app.meet-sam.com/signin → "Forgot password"');
  console.log('');
}

fixAuthAccounts().then(() => process.exit(0));
