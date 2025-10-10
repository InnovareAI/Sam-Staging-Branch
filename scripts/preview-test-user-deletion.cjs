#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

const TEST_USER_EMAILS = [
  'tl+2@chillmine.io',
  'tl+10@innovareai.com',
  'tl+15@innvoareai.com'
];

async function preview() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: testUsers } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .in('email', TEST_USER_EMAILS);

  console.log('\n🔍 Test User Deletion Preview\n');
  console.log(`📋 ${testUsers?.length || 0} test users will be deleted:\n`);

  if (testUsers && testUsers.length > 0) {
    testUsers.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email} (${user.first_name || 'N/A'} ${user.last_name || 'N/A'})`);
    });

    const userIds = testUsers.map(u => u.id);

    const { count: memberships } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds);

    const { count: accounts } = await supabase
      .from('workspace_accounts')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds);

    console.log('\n📊 Related data that will be deleted:');
    console.log(`   - Workspace memberships: ${memberships || 0}`);
    console.log(`   - Workspace accounts: ${accounts || 0}`);
  }

  const { data: allUsers } = await supabase
    .from('users')
    .select('email')
    .order('created_at', { ascending: false });

  const remaining = allUsers?.filter(u => !TEST_USER_EMAILS.includes(u.email)) || [];

  console.log(`\n✅ ${remaining.length} users will remain:\n`);
  remaining.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email}`);
  });

  console.log('\n📝 To delete these test users, run:');
  console.log('   node scripts/delete-test-users.cjs --confirm\n');
}

preview().then(() => process.exit(0));
