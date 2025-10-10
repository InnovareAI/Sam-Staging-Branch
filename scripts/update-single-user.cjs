#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
const firstName = process.argv[3];
const lastName = process.argv[4];

if (!email || !firstName || !lastName) {
  console.log('Usage: node update-single-user.cjs <email> <first_name> <last_name>');
  process.exit(1);
}

async function updateUser() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from('users')
    .update({ first_name: firstName, last_name: lastName })
    .eq('email', email)
    .select();

  if (error) {
    console.error('❌ Error:', error);
  } else if (data && data.length > 0) {
    console.log(`✅ Updated ${email} → ${firstName} ${lastName}`);
  } else {
    console.log(`⚠️  User not found: ${email}`);
  }
}

updateUser().then(() => process.exit(0));
