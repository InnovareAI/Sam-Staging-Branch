#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkIA1Owner() {
  console.log('🔍 Checking IA1 workspace owner...\n');

  // Get workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, client_code')
    .eq('name', 'IA1')
    .single();

  if (wsError || !workspace) {
    console.log('❌ Workspace IA1 not found');
    console.error(wsError);
    return;
  }

  console.log('✅ Workspace found:');
  console.log(`   ID: ${workspace.id}`);
  console.log(`   Name: ${workspace.name}`);
  console.log(`   Code: ${workspace.client_code || 'N/A'}\n`);

  // Get members
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id, role, status')
    .eq('workspace_id', workspace.id)
    .order('role');

  if (membersError) {
    console.error('❌ Error fetching members:', membersError);
    return;
  }

  console.log(`📋 Workspace Members (${members?.length || 0}):\n`);

  for (const member of members || []) {
    // Get user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(member.user_id);

    if (user) {
      console.log(`   ${member.role.toUpperCase()}: ${user.email}`);
      console.log(`   └─ User ID: ${member.user_id}`);
      console.log(`   └─ Status: ${member.status}\n`);
    } else {
      console.log(`   ${member.role.toUpperCase()}: [User not found]`);
      console.log(`   └─ User ID: ${member.user_id}\n`);
    }
  }
}

checkIA1Owner().catch(console.error);
