#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

const NAME_UPDATES = [
  { email: 'tl@innovareai.com', first_name: 'Thorsten', last_name: 'Linz' },
  { email: 'cl@innovareai.com', first_name: 'Chona', last_name: 'Lamberte' },
  { email: 'cs@innovareai.com', first_name: 'Charissa', last_name: 'Saniel' },
  { email: 'mg@innovareai.com', first_name: 'Michelle', last_name: 'Gestuveo' }
];

async function updateUserNames() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('\n📝 Updating user names...\n');

  for (const update of NAME_UPDATES) {
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: update.first_name,
        last_name: update.last_name
      })
      .eq('email', update.email)
      .select();

    if (error) {
      console.error(`❌ Error updating ${update.email}:`, error);
    } else if (data && data.length > 0) {
      console.log(`✅ Updated ${update.email} → ${update.first_name} ${update.last_name}`);
    } else {
      console.log(`⚠️  User not found: ${update.email}`);
    }
  }

  console.log('\n✅ Name updates complete\n');
}

updateUserNames().then(() => process.exit(0));
