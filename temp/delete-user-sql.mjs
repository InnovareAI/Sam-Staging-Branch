#!/usr/bin/env node

/**
 * Delete ny@3cubed.ai user via SQL
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'auth' }
});

console.log('🗑️  Deleting ny@3cubed.ai via SQL\n');

// Execute raw SQL to delete from auth.users
const { data, error } = await supabase.rpc('exec_sql', {
  query: `DELETE FROM auth.users WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899'`
});

if (error) {
  console.error('❌ Error executing SQL:', error);

  // Try alternative approach: use Supabase REST API directly
  console.log('\n🔄 Trying alternative approach via REST API...\n');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: '567ba664-812c-4bed-8c2f-96113b99f899'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ REST API error:', errorText);

    // Final attempt: manually construct Postgres connection
    console.log('\n⚠️  Auto-deletion failed. User must be deleted manually.');
    console.log('\nOption 1: Supabase Dashboard');
    console.log('  1. Go to: https://supabase.com/dashboard');
    console.log('  2. Select project: latxadqrvrrrcvkktrog');
    console.log('  3. Authentication → Users');
    console.log('  4. Search: ny@3cubed.ai');
    console.log('  5. Delete user');
    console.log('\nOption 2: SQL Editor');
    console.log('  1. Go to: https://supabase.com/dashboard');
    console.log('  2. SQL Editor → New Query');
    console.log('  3. Run:');
    console.log("     DELETE FROM auth.users WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';");
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ User deleted via REST API:', result);
} else {
  console.log('✅ User deleted successfully:', data);
}

// Verify deletion
const { data: checkUser } = await supabase.auth.admin.getUserById('567ba664-812c-4bed-8c2f-96113b99f899');

if (!checkUser.user) {
  console.log('\n✅ Verified: User no longer exists\n');
} else {
  console.log('\n⚠️  User still exists. Manual deletion required.\n');
}
