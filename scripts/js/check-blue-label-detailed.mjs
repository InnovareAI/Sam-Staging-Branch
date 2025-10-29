#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Blue Label Labs - Detailed Analysis\n');

// Get workspace info
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', workspaceId)
  .single();

console.log('📁 Workspace:', workspace?.name);
console.log('   Created:', workspace?.created_at);

// Check members
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*)')
  .eq('workspace_id', workspaceId);

console.log(`\n👥 Members: ${members?.length || 0}`);
if (members && members.length > 0) {
  members.forEach(m => {
    console.log(`   - ${m.users?.email || 'Unknown'} (${m.role})`);
  });
} else {
  console.log('   ⚠️ NO MEMBERS FOUND - This is the problem!');
  console.log('   Stan cannot access the workspace because he is not a member');
}

// Check all users who might be Stan
const { data: allUsers } = await supabase
  .from('users')
  .select('id, email, raw_user_meta_data')
  .or('email.ilike.%stan%,email.ilike.%bounev%,email.ilike.%bluelabel%');

console.log(`\n🔍 Users matching "stan" or "bounev" or "bluelabel":`);
if (allUsers && allUsers.length > 0) {
  allUsers.forEach(u => {
    console.log(`   - ${u.email}`);
    console.log(`     ID: ${u.id}`);
    console.log(`     Name: ${u.raw_user_meta_data?.full_name || 'N/A'}`);
  });
}

// Check workspace_prospects with correct columns
const { data: prospects } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status, created_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\n📊 Workspace Prospects (showing 10 of ${prospects?.length || 0}):`);
if (prospects && prospects.length > 0) {
  prospects.forEach(p => {
    console.log(`   - ${p.first_name || 'N/A'} ${p.last_name || 'N/A'}`);
    console.log(`     Company: ${p.company_name || 'N/A'}`);
    console.log(`     Status: ${p.status || 'N/A'}`);
    console.log(`     Created: ${p.created_at}`);
  });
}

// Get total count
const { count: totalCount } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

console.log(`\n📈 Total Prospects in Database: ${totalCount || 0}`);

// Check if RLS is blocking access
console.log(`\n🔐 RLS Check:`);
console.log('   Using service role key - bypasses RLS');
console.log('   If Stan cannot see prospects, it is because:');
console.log('   1. He is not a workspace member (confirmed above)');
console.log('   2. OR RLS policies require workspace membership');

console.log(`\n✅ DIAGNOSIS:`);
if (!members || members.length === 0) {
  console.log('   The prospects are NOT lost - they exist in the database!');
  console.log(`   There are ${totalCount} prospects in the workspace.`);
  console.log('   ');
  console.log('   PROBLEM: Stan is not a member of this workspace.');
  console.log('   SOLUTION: Add Stan as a workspace member.');
  console.log('   ');
  console.log('   To fix: Find Stan\'s user ID and add him to workspace_members table.');
}
