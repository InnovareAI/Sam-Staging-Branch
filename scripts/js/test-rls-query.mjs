#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

// Simulate what the API does - create a client that uses the user's session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Testing RLS query as if user is authenticated...\n');

// First, verify the user is a member of the workspace
console.log('1. Checking workspace membership:');
const { data: membership } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('user_id', userId)
  .eq('workspace_id', workspaceId)
  .single();

console.log('   Membership:', membership ? '✅ Found' : '❌ Not found');
if (membership) {
  console.log(`   Role: ${membership.role}\n`);
}

// Now try the exact query the API uses, but we need to SET the user context
// The issue is that with service role, there's no auth.uid()
// Let's try with RLS enabled
console.log('2. Testing query WITH RLS (simulating API):');

// We can't easily simulate auth.uid() from a script
// But let's see what the RLS policy would see
const { data: rlsTest, error: rlsError } = await supabase.rpc('auth.uid');
console.log('   auth.uid() returns:', rlsTest, 'Error:', rlsError);

// The real test: query with service role (bypasses RLS)
console.log('\n3. Query with service role (bypasses RLS):');
const { data: serviceData } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .eq('workspace_id', workspaceId);

console.log(`   Result: ${serviceData?.length || 0} monitors found\n`);

console.log('🔍 DIAGNOSIS:');
console.log('   The API uses createServerSupabaseClient() which should have the user session.');
console.log('   But the RLS policies check auth.uid(), which requires an authenticated session.');
console.log('   The issue is likely that the server client is not preserving the auth session properly.');
