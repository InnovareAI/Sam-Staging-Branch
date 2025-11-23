#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Testing RLS policies directly...\n');

// Test 1: Service role (bypasses RLS)
console.log('1. Testing with SERVICE ROLE (bypasses RLS):');
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: adminData, error: adminError } = await supabaseAdmin
  .from('linkedin_post_monitors')
  .select('*')
  .eq('workspace_id', workspaceId);

console.log(`   Result: ${adminData?.length || 0} monitors found`);
if (adminError) console.log('   Error:', adminError);
if (adminData?.length > 0) {
  console.log('   Monitor IDs:', adminData.map(m => m.id));
}

// Test 2: Check workspace membership exists
console.log('\n2. Checking workspace membership:');
const { data: membership, error: memberError } = await supabaseAdmin
  .from('workspace_members')
  .select('*')
  .eq('user_id', userId)
  .eq('workspace_id', workspaceId)
  .single();

console.log(`   Membership: ${membership ? '✅ Found' : '❌ Not found'}`);
if (membership) {
  console.log(`   Role: ${membership.role}`);
  console.log(`   User ID: ${membership.user_id}`);
  console.log(`   Workspace ID: ${membership.workspace_id}`);
}
if (memberError) console.log('   Error:', memberError);

// Test 3: Check RLS policies exist
console.log('\n3. Checking RLS policies on linkedin_post_monitors:');
const { data: policies, error: policyError } = await supabaseAdmin
  .from('pg_policies')
  .select('policyname, cmd, qual, with_check')
  .eq('tablename', 'linkedin_post_monitors');

if (policies && policies.length > 0) {
  console.log(`   Found ${policies.length} policies:`);
  policies.forEach(p => {
    console.log(`   - ${p.policyname} (${p.cmd})`);
  });
} else {
  console.log('   ⚠️ No RLS policies found!');
}
if (policyError) console.log('   Error:', policyError);

// Test 4: Check if RLS is enabled
console.log('\n4. Checking if RLS is enabled on table:');
const { data: tableInfo } = await supabaseAdmin.rpc('sql', {
  query: `SELECT relrowsecurity FROM pg_class WHERE relname = 'linkedin_post_monitors'`
});
console.log('   RLS enabled:', tableInfo);

console.log('\n💡 DIAGNOSIS:');
console.log('   If service role returns monitors but RLS blocks them, the issue is:');
console.log('   - RLS policies are too restrictive, OR');
console.log('   - The API server client is not getting proper auth context');
