#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMembership() {
  const userId = 'c9be4bd2-a560-4707-9d05-74a32d41ca18';
  
  console.log('🔍 Checking workspace_members table...\n');

  // Direct query without join
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId);

  console.log('Query error:', memberError);
  console.log('Raw memberships found:', members?.length || 0);
  console.log('Data:', JSON.stringify(members, null, 2));

  // Try with workspace join
  const { data: withJoin, error: joinError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', userId);

  console.log('\n🔍 With workspace join:');
  console.log('Query error:', joinError);
  console.log('Joined data:', JSON.stringify(withJoin, null, 2));
}

debugMembership().catch(console.error);
