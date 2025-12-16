#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 SEARCHING FOR STAN\'S WORKSPACE');
console.log('='.repeat(70));

// Find Stan's workspace - try multiple approaches
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .or('name.ilike.%stan%,name.ilike.%tursio%');

console.log('\n1️⃣ Workspaces matching "stan" or "tursio":');
console.log(JSON.stringify(workspaces, null, 2));

// Also check all workspaces to see what's available
const { data: allWorkspaces } = await supabase
  .from('workspaces')
  .select('id, name, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('\n2️⃣ Recent workspaces (last 20):');
for (const ws of allWorkspaces || []) {
  console.log(`   - ${ws.name} (${ws.id.slice(0, 8)}...)`);
}

// Check workspace members for anyone named Stan
const { data: members } = await supabase
  .from('workspace_members')
  .select(`
    workspace_id,
    users!inner (
      id,
      email,
      full_name
    )
  `)
  .ilike('users.full_name', '%stan%');

console.log('\n3️⃣ Members named "Stan":');
if (members && members.length > 0) {
  for (const m of members) {
    const user = m.users;
    console.log(`   - ${user.full_name} (${user.email})`);
    console.log(`     Workspace: ${m.workspace_id}`);
  }
} else {
  console.log('   No members found with "Stan" in name');
}

// Also try email search
const { data: emailSearch } = await supabase
  .from('workspace_members')
  .select(`
    workspace_id,
    users!inner (
      id,
      email,
      full_name
    )
  `)
  .ilike('users.email', '%stan%');

console.log('\n4️⃣ Members with "stan" in email:');
if (emailSearch && emailSearch.length > 0) {
  for (const m of emailSearch) {
    const user = m.users;
    console.log(`   - ${user.full_name || 'N/A'} (${user.email})`);
    console.log(`     Workspace: ${m.workspace_id}`);
  }
} else {
  console.log('   No members found with "stan" in email');
}

console.log('\n' + '='.repeat(70));
