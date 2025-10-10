#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get one user with all fields
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (users && users.length > 0) {
    console.log('📋 Users table fields:\n');
    const fields = Object.keys(users[0]);
    fields.forEach(field => {
      console.log(`  - ${field}: ${typeof users[0][field]} (${users[0][field] || 'null'})`);
    });
  }

  // Also get all users to see tag values
  const { data: allUsers } = await supabase
    .from('users')
    .select('email, first_name, last_name, *')
    .order('created_at', { ascending: false });

  console.log('\n📊 All users with all fields:\n');
  allUsers?.forEach(user => {
    console.log(`${user.email}:`);
    Object.keys(user).forEach(key => {
      if (key.includes('tag') || key.includes('reseller') || key.includes('affiliation') || key.includes('company')) {
        console.log(`  ${key}: ${user[key]}`);
      }
    });
    console.log('');
  });
}

checkSchema().then(() => process.exit(0));
