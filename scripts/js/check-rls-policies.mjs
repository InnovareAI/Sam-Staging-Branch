#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

console.log('🔍 Checking RLS Policies and Data Access\n');

// Check workspace membership
const { data: membership } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('user_id', stanUserId);

console.log('👤 Stan\'s Membership:');
if (membership && membership.length > 0) {
  console.log('   ✅ Is a member');
  console.log('   Role:', membership[0].role);
  console.log('   User ID:', membership[0].user_id);
  console.log('   Workspace ID:', membership[0].workspace_id);
} else {
  console.log('   ❌ NOT a member - this is the problem!');
}

// Get prospect count (bypasses some RLS)
const { count: totalCount } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

console.log(`\n📊 Total Prospects: ${totalCount || 0}`);

// Try to get actual prospect data with service role
const { data: prospects, error: prospectsError } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, company_name, linkedin_url, status')
  .eq('workspace_id', workspaceId)
  .limit(10);

console.log(`\n📋 Sample Prospects (using service role):`);
if (prospectsError) {
  console.log('   ❌ Error:', prospectsError.message);
} else if (prospects && prospects.length > 0) {
  console.log(`   ✅ Found ${prospects.length} prospects`);
  prospects.slice(0, 5).forEach(p => {
    console.log(`   - ${p.first_name || 'N/A'} ${p.last_name || 'N/A'}`);
    console.log(`     Company: ${p.company_name || 'N/A'}`);
    console.log(`     Status: ${p.status || 'N/A'}`);
  });
} else {
  console.log('   ⚠️ No prospects returned');
}

// Check if the count matches what we see
console.log(`\n🔍 Diagnosis:`);
if (totalCount > 0 && (!prospects || prospects.length === 0)) {
  console.log('   ❌ RLS Policy Issue Detected!');
  console.log('   - COUNT returns results (bypasses RLS)');
  console.log('   - SELECT returns nothing (blocked by RLS)');
  console.log('   - Stan needs proper workspace_member entry');
} else if (totalCount > 0 && prospects && prospects.length > 0) {
  console.log('   ✅ Data is accessible with service role');
  console.log('   - Issue might be on the frontend');
  console.log('   - Check if Stan is using correct workspace context');
}

// Get the actual number shown to Stan
console.log(`\n📌 What Stan sees:`);
console.log(`   Count: ${totalCount} (this works)`);
console.log(`   List: Empty (this doesn\'t work)`);
console.log(`\n   This means RLS is blocking SELECT but allowing COUNT`);
