#!/usr/bin/env node

/**
 * List Test Users Script
 * Identifies and lists test user accounts in the database
 */

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function listTestUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔍 Searching for test user accounts...\n');

  // Get all users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching users:', error);
    return;
  }

  // Identify test users by common patterns
  const testPatterns = [
    /test/i,
    /demo/i,
    /sample/i,
    /example/i,
    /fake/i,
    /@test\./i,
    /@example\./i,
    /\+test@/i,
    /temp/i
  ];

  const testUsers = users.filter(user => {
    const email = user.email || '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';

    return testPatterns.some(pattern =>
      pattern.test(email) ||
      pattern.test(firstName) ||
      pattern.test(lastName)
    );
  });

  const realUsers = users.filter(user => !testUsers.includes(user));

  console.log('📊 User Summary:');
  console.log(`   Total users: ${users.length}`);
  console.log(`   Test users: ${testUsers.length}`);
  console.log(`   Real users: ${realUsers.length}\n`);

  if (testUsers.length > 0) {
    console.log('🧪 Test Users Found:\n');
    testUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);
    });
  } else {
    console.log('✅ No test users found matching common patterns\n');
  }

  console.log('👥 Real Users:\n');
  realUsers.slice(0, 10).forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);
  });

  if (realUsers.length > 10) {
    console.log(`   ... and ${realUsers.length - 10} more\n`);
  }
}

listTestUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
