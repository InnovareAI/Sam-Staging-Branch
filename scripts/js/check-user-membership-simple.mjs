#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMembership() {
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n👥 CHECKING WORKSPACE MEMBERSHIP\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get all members of this workspace
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${members?.length || 0} members in workspace:\n`);
  
  members?.forEach((m, i) => {
    console.log(`${i + 1}. User ID: ${m.user_id}`);
    console.log(`   └─ Role: ${m.role}\n`);
  });

  // Check auth.users table for these user IDs
  if (members && members.length > 0) {
    console.log('Checking user details from auth.users...\n');
    for (const member of members.slice(0, 5)) {
      const { data: { user } } = await supabase.auth.admin.getUserById(member.user_id);
      if (user) {
        console.log(`   ${user.email} (${member.role})`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

checkMembership();
