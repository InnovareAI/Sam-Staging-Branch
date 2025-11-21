#!/usr/bin/env node
/**
 * Fix IA7 workspace membership record
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const USER_ID = '59b1063e-672c-49c6-b3b7-02081a500209'; // tbslinz@icloud.com

console.log('🔧 FIXING IA7 WORKSPACE MEMBERSHIP...\n');

// 1. Delete existing incomplete membership
const { error: deleteError } = await supabase
  .from('workspace_members')
  .delete()
  .eq('workspace_id', WORKSPACE_ID)
  .eq('user_id', USER_ID);

if (deleteError) {
  console.error('⚠️  Error deleting old membership:', deleteError.message);
} else {
  console.log('✅ Removed old membership record');
}

// 2. Insert complete membership record
const { error: insertError } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: WORKSPACE_ID,
    user_id: USER_ID,
    role: 'admin',
    joined_at: new Date().toISOString()
  });

if (insertError) {
  console.error('❌ Error inserting membership:', insertError.message);
  process.exit(1);
}

console.log('✅ Created new membership record with joined_at');

// 3. Update user's current_workspace_id
const { error: updateError } = await supabase
  .from('users')
  .update({ current_workspace_id: WORKSPACE_ID })
  .eq('id', USER_ID);

if (updateError) {
  console.error('⚠️  Error updating current_workspace_id:', updateError.message);
} else {
  console.log('✅ Set current_workspace_id in users table');
}

// 4. Verify everything
const { data: membership } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('user_id', USER_ID)
  .single();

console.log('\n🔍 Verification:');
if (membership) {
  console.log('✅ Membership record:');
  console.log('   Workspace ID:', membership.workspace_id);
  console.log('   User ID:', membership.user_id);
  console.log('   Role:', membership.role);
  console.log('   Joined At:', membership.joined_at);
} else {
  console.log('❌ No membership record found');
}

const { data: user } = await supabase
  .from('users')
  .select('id, email, current_workspace_id')
  .eq('id', USER_ID)
  .single();

if (user) {
  console.log('\n✅ User record:');
  console.log('   Email:', user.email);
  console.log('   Current Workspace:', user.current_workspace_id);
}

console.log('\n📋 Try logging in again:');
console.log('   URL: https://app.meet-sam.com');
console.log('   Email: tbslinz@icloud.com');
console.log('   Password: TempPass123!');
