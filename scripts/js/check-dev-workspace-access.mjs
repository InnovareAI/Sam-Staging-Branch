#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkDevAccess() {
  try {
    console.log('🔍 Checking dev@innovareai.com workspace access...\n');

    // Find dev user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'dev@innovareai.com');

    if (userError) {
      console.error('❌ Error finding user:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ dev@innovareai.com user not found in users table');
      return;
    }

    const devUser = users[0];
    console.log('✅ Found user:', devUser.email);
    console.log('   User ID:', devUser.id);
    console.log('');

    // Check workspace membership
    const { data: members, error: memberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', devUser.id)
      .eq('workspace_id', workspaceId);

    if (memberError) {
      console.error('❌ Error checking membership:', memberError.message);
      return;
    }

    if (!members || members.length === 0) {
      console.log('❌ dev@innovareai.com is NOT a member of InnovareAI workspace');
      console.log('   Workspace ID:', workspaceId);
      console.log('\n💡 Need to add dev user to workspace_members table');
      return;
    }

    console.log('✅ dev@innovareai.com IS a member of InnovareAI workspace');
    console.log('   Role:', members[0].role);
    console.log('   Joined:', members[0].created_at);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDevAccess();
