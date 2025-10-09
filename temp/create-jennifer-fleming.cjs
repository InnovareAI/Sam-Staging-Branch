require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

async function createJenniferFleming() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const EMAIL = 'jf@innovareai.com';
  const FULL_NAME = 'Jennifer Fleming';

  console.log('🔧 Creating user account for Jennifer Fleming');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Create user in users table
  console.log('1️⃣ Creating user account...');
  const newUserId = randomUUID();

  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      id: newUserId,
      email: EMAIL,
      full_name: FULL_NAME,
      current_workspace_id: WORKSPACE_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (userError) {
    console.log('   ❌ Error creating user:', userError.message);
    return;
  }

  console.log('   ✅ User created!');
  console.log('      User ID:', newUserId);
  console.log('      Email:', EMAIL);
  console.log('      Full Name:', FULL_NAME);
  console.log('');

  // Step 2: Add to workspace_members
  console.log('2️⃣ Adding to InnovareAI workspace...');
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: WORKSPACE_ID,
      user_id: newUserId,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (memberError) {
    console.log('   ❌ Error adding to workspace:', memberError.message);
    return;
  }

  console.log('   ✅ Added to workspace!');
  console.log('      Workspace ID:', WORKSPACE_ID);
  console.log('      Role: admin');
  console.log('');

  // Step 3: Re-associate email account
  console.log('3️⃣ Re-associating email account...');
  const { data: updatedAccount, error: accountError } = await supabase
    .from('workspace_accounts')
    .update({
      user_id: newUserId,
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', WORKSPACE_ID)
    .eq('account_type', 'email')
    .eq('account_identifier', EMAIL)
    .select();

  if (accountError) {
    console.log('   ❌ Error re-associating email:', accountError.message);
    return;
  }

  console.log('   ✅ Email account re-associated!');
  console.log('      Account:', EMAIL);
  console.log('      New User ID:', newUserId);
  console.log('      Records updated:', updatedAccount?.length || 0);
  console.log('');

  // Step 4: Verify everything
  console.log('4️⃣ Verification...');

  const { data: verifyUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', newUserId)
    .single();

  const { data: verifyMember } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', newUserId)
    .single();

  const { data: verifyEmail } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', newUserId)
    .eq('account_type', 'email');

  console.log('   ✅ User exists:', !!verifyUser);
  console.log('   ✅ Workspace member:', !!verifyMember, `(role: ${verifyMember?.role})`);
  console.log('   ✅ Email accounts:', verifyEmail?.length || 0);
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('🎉 SUCCESS!');
  console.log('');
  console.log('Jennifer Fleming is now set up with:');
  console.log('   - User account:', EMAIL);
  console.log('   - User ID:', newUserId);
  console.log('   - Workspace: InnovareAI (admin)');
  console.log('   - Email account: jf@innovareai.com');
  console.log('');
  console.log('⚠️  IMPORTANT: Jennifer needs to set her password by:');
  console.log('   1. Go to https://app.meet-sam.com/signin');
  console.log('   2. Click "Forgot password"');
  console.log('   3. Enter: jf@innovareai.com');
  console.log('   4. Check email for password reset link');
  console.log('');
}

createJenniferFleming().then(() => process.exit(0));
