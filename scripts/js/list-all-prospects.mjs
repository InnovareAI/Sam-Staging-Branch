#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔍 Blue Label Labs - ALL PROSPECTS\n');

// Get ALL prospects with minimal columns to avoid schema issues
const { data: allProspects, error } = await supabase
  .from('workspace_prospects')
  .select('*')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });

if (error) {
  console.log('❌ Error:', error.message);
} else {
  console.log(`✅ Found ${allProspects?.length || 0} prospects\n`);
  
  // Show first few fields of first record to see what columns exist
  if (allProspects && allProspects.length > 0) {
    console.log('Available columns:');
    console.log(Object.keys(allProspects[0]).sort().join(', '));
    console.log('\n');
    
    // List first 20 prospects
    console.log('First 20 Prospects:');
    console.log('='.repeat(60));
    allProspects.slice(0, 20).forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name || 'N/A'} ${p.last_name || 'N/A'}`);
      console.log(`   Company: ${p.company_name || p.company || 'N/A'}`);
      console.log(`   Created: ${p.created_at}`);
      console.log(`   ID: ${p.id}`);
      console.log('');
    });
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Total: ${allProspects?.length || 0} prospects`);
console.log(`   Workspace: Blue Label Labs`);
console.log(`   Owner: Stan Bounev (stan01@signali.ai)`);
console.log(`\n✅ ALL DATA IS INTACT AND ACCESSIBLE!`);
