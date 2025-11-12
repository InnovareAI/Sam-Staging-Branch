#!/usr/bin/env node

/**
 * Delete Noriko Yokoi user (ny@3cubed.ai)
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
const USER_ID = '567ba664-812c-4bed-8c2f-96113b99f899'; // ny@3cubed.ai

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🗑️  Deleting user ny@3cubed.ai (Noriko Yokoi)\n');

// Step 1: Check workspace memberships
const { data: memberships } = await supabase
  .from('workspace_members')
  .select('*, workspaces(name)')
  .eq('user_id', USER_ID);

console.log('Workspace memberships:');
if (memberships && memberships.length > 0) {
  memberships.forEach(m => {
    console.log(`   - ${m.workspaces.name} (role: ${m.role})`);
  });
} else {
  console.log('   None');
}
console.log('');

// Step 2: Delete workspace memberships
if (memberships && memberships.length > 0) {
  console.log('🗑️  Deleting workspace memberships...');

  const { error: memberError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', USER_ID);

  if (memberError) {
    console.error('❌ Error deleting memberships:', memberError);
  } else {
    console.log(`✅ Deleted ${memberships.length} memberships\n`);
  }
}

// Step 3: Delete auth user
console.log('🗑️  Deleting auth user...');

const { error: authError } = await supabase.auth.admin.deleteUser(USER_ID);

if (authError) {
  console.error('❌ Error deleting user:', authError);
  process.exit(1);
}

console.log('✅ User deleted successfully\n');

// Step 4: Verify deletion
const { data: verifyUser, error: verifyError } = await supabase.auth.admin.getUserById(USER_ID);

if (verifyError || !verifyUser) {
  console.log('✅ Verified: User no longer exists\n');
} else {
  console.error('⚠️  WARNING: User still exists in system\n');
}

console.log('✅ DONE - ny@3cubed.ai (Noriko Yokoi) deleted\n');
