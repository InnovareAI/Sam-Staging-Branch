require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

async function createTeamAccounts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  const NEW_USERS = [
    {
      email: 'jf@innovareai.com',
      first_name: 'Jennifer',
      last_name: 'Fleming',
      role: 'admin'
    },
    {
      email: 'im@innovareai.com',
      first_name: 'Irish',
      last_name: 'Maguad',
      role: 'admin'
    }
  ];

  console.log('🔧 Creating InnovareAI Team Accounts');
  console.log('='.repeat(60));
  console.log('');

  const results = [];

  for (const newUserData of NEW_USERS) {
    const fullName = `${newUserData.first_name} ${newUserData.last_name}`;
    console.log(`\n📝 Processing: ${fullName} (${newUserData.email})`);
    console.log('-'.repeat(60));

    const result = {
      email: newUserData.email,
      full_name: fullName,
      userId: null,
      userCreated: false,
      membershipCreated: false,
      emailAssociated: false,
      linkedinAssociated: false,
      errors: []
    };

    // Step 1: Create user
    console.log('1️⃣ Creating user account...');
    const newUserId = randomUUID();
    result.userId = newUserId;

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        email: newUserData.email,
        first_name: newUserData.first_name,
        last_name: newUserData.last_name,
        current_workspace_id: WORKSPACE_ID,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) {
      console.log('   ❌ Error:', userError.message);
      result.errors.push(`User creation: ${userError.message}`);
      continue; // Skip to next user if user creation fails
    } else {
      console.log('   ✅ User created!');
      result.userCreated = true;
    }

    // Step 2: Add to workspace
    console.log('2️⃣ Adding to workspace...');
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: WORKSPACE_ID,
        user_id: newUserId,
        role: newUserData.role,
        status: 'active',
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (memberError) {
      console.log('   ❌ Error:', memberError.message);
      result.errors.push(`Workspace membership: ${memberError.message}`);
    } else {
      console.log('   ✅ Added as', newUserData.role);
      result.membershipCreated = true;
    }

    // Step 3: Re-associate email account (if exists)
    console.log('3️⃣ Re-associating email account...');
    const emailPrefix = newUserData.email.split('@')[0];
    const { data: emailAccount, error: emailError } = await supabase
      .from('workspace_accounts')
      .update({
        user_id: newUserId,
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', WORKSPACE_ID)
      .eq('account_type', 'email')
      .ilike('account_identifier', `${emailPrefix}@%`)
      .select();

    if (emailError) {
      console.log('   ❌ Error:', emailError.message);
      result.errors.push(`Email re-association: ${emailError.message}`);
    } else if (emailAccount && emailAccount.length > 0) {
      console.log('   ✅ Email account re-associated!');
      console.log('      Accounts:', emailAccount.map(a => a.account_identifier).join(', '));
      result.emailAssociated = true;
    } else {
      console.log('   ⚠️  No email account found to re-associate');
    }

    // Step 4: Re-associate LinkedIn account (if exists)
    console.log('4️⃣ Re-associating LinkedIn account...');
    const { data: linkedinAccount, error: linkedinError } = await supabase
      .from('workspace_accounts')
      .update({
        user_id: newUserId,
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', WORKSPACE_ID)
      .eq('account_type', 'linkedin')
      .ilike('account_identifier', `%${newUserData.first_name}%`)
      .select();

    if (linkedinError) {
      console.log('   ❌ Error:', linkedinError.message);
      result.errors.push(`LinkedIn re-association: ${linkedinError.message}`);
    } else if (linkedinAccount && linkedinAccount.length > 0) {
      console.log('   ✅ LinkedIn account re-associated!');
      console.log('      Accounts:', linkedinAccount.map(a => a.account_name).join(', '));
      result.linkedinAssociated = true;
    } else {
      console.log('   ⚠️  No LinkedIn account found to re-associate');
    }

    results.push(result);
  }

  // Final Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  let successCount = 0;
  results.forEach((result, i) => {
    const isSuccess = result.userCreated && result.membershipCreated;
    if (isSuccess) successCount++;

    const status = isSuccess ? '✅' : '⚠️';
    console.log(`${i + 1}. ${status} ${result.full_name} (${result.email})`);
    console.log(`   User ID: ${result.userId}`);
    console.log(`   User Created: ${result.userCreated ? '✅' : '❌'}`);
    console.log(`   Workspace Member: ${result.membershipCreated ? '✅' : '❌'}`);
    console.log(`   Email Account: ${result.emailAssociated ? '✅' : '⚠️ None found'}`);
    console.log(`   LinkedIn Account: ${result.linkedinAssociated ? '✅' : '⚠️ None found'}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
    console.log('');
  });

  console.log('='.repeat(60));
  console.log(`🎉 Successfully created ${successCount} of ${results.length} accounts!`);
  console.log('');
  console.log('⚠️  IMPORTANT: New users need to set passwords by:');
  console.log('   1. Go to https://app.meet-sam.com/signin');
  console.log('   2. Click "Forgot password"');
  console.log('   3. Enter their email');
  console.log('   4. Check email for password reset link');
  console.log('');
}

createTeamAccounts().then(() => process.exit(0));
