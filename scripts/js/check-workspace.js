#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspace(email) {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log('✅ User:', user.email, user.id);
  
  // Check in users table
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .maybeSingle();
  
  console.log('📍 users.current_workspace_id:', profile?.current_workspace_id || 'NULL');
  
  // Check memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, slug)')
    .eq('user_id', user.id);
  
  console.log('\n📊 Workspace memberships:');
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      console.log(`   - ${m.workspaces?.name} (${m.workspace_id}) [${m.role}]`);
    });
  } else {
    console.log('   None');
  }
}

checkWorkspace(process.argv[2] || 'tl@innovareai.com').catch(console.error);