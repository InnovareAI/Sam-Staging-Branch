#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

console.log('🔍 Testing monitors API with authenticated user...\n');

// First, let's check workspace members for tl@innovareai.com
console.log('1. Finding user ID for tl@innovareai.com...');
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id, email')
  .eq('email', 'tl@innovareai.com')
  .single();

if (userError) {
  console.error('❌ Error finding user:', userError);
  process.exit(1);
}

console.log(`✅ Found user: ${users.email} (${users.id})\n`);

// Check workspace memberships
console.log('2. Checking workspace memberships...');
const { data: memberships, error: memberError } = await supabase
  .from('workspace_members')
  .select('workspace_id, role')
  .eq('user_id', users.id);

if (memberError) {
  console.error('❌ Error:', memberError);
} else {
  console.log(`✅ Found ${memberships.length} workspace memberships:`);
  memberships.forEach((m, idx) => {
    console.log(`   ${idx + 1}. Workspace: ${m.workspace_id} (${m.role})`);
  });
}

console.log('\n3. Checking monitors for InnovareAI workspace...');
const innovareWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

// Try to fetch monitors using anon key (mimics what the API does)
const { data: monitors, error: monitorError } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .eq('workspace_id', innovareWorkspaceId);

if (monitorError) {
  console.error('❌ Error fetching monitors:', monitorError);
} else {
  console.log(`Result: ${monitors.length} monitors found`);
  if (monitors.length === 0) {
    console.log('\n⚠️  RLS is blocking the query!');
    console.log('   The policies check auth.uid() but anon key has no user context.');
    console.log('   The API route needs to use the authenticated session.');
  }
}
