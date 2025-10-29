#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Fetching Blue Label Labs Prospects\n');

// Get prospects with only known columns
const { data: prospects, error } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, company_name, status, created_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.log('❌ Error:', error.message);
  console.log('\nTrying with minimal columns...');
  
  // Try with just id
  const { data: minData, error: minError } = await supabase
    .from('workspace_prospects')
    .select('id')
    .eq('workspace_id', workspaceId)
    .limit(5);
  
  if (minError) {
    console.log('❌ Still error:', minError.message);
  } else {
    console.log('✅ Minimal query works, found', minData?.length, 'records');
  }
} else {
  console.log(`✅ Found ${prospects?.length || 0} prospects:\n`);
  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name || 'N/A'} ${p.last_name || 'N/A'}`);
    console.log(`   Company: ${p.company_name || 'N/A'}`);
    console.log(`   Status: ${p.status || 'N/A'}`);
    console.log(`   ID: ${p.id}`);
    console.log('');
  });
}

// Get total count
const { count } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

console.log(`\n📊 Total Count: ${count || 0} prospects`);
console.log('\n🔍 Issue Analysis:');
console.log('   If count shows 97 but list shows 0 or fewer:');
console.log('   - RLS policy is blocking SELECT queries');
console.log('   - Stan needs to refresh his session');
console.log('   - Or frontend needs to use correct workspace context');
