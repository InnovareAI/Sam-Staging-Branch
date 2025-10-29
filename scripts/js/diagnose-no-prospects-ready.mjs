#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 DIAGNOSING: No prospects ready for messaging\n');

const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

// Get the test 9 campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('name', '20251029-IAI-test 9')
  .single();

console.log(`Campaign: ${campaign.name} (${campaign.id})`);
console.log(`Status: ${campaign.status}\n`);

// Get ALL prospects for this campaign
const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

console.log(`Total prospects: ${allProspects?.length || 0}\n`);

if (!allProspects || allProspects.length === 0) {
  console.log('❌ NO PROSPECTS IN CAMPAIGN!');
  process.exit(0);
}

// Analyze each prospect
console.log('Analyzing each prospect:\n');

allProspects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
  console.log(`   Contacted at: ${p.contacted_at || 'Never'}`);
  console.log(`   Added by account: ${p.added_by_unipile_account || 'N/A'}`);
  
  // Check what would filter this out
  const reasons = [];
  
  if (!p.linkedin_url) {
    reasons.push('❌ No LinkedIn URL');
  }
  
  if (!['pending', 'approved', 'ready_to_message'].includes(p.status)) {
    reasons.push(`❌ Status is "${p.status}" (needs: pending, approved, or ready_to_message)`);
  }
  
  if (p.contacted_at) {
    reasons.push('⚠️ Already contacted');
  }
  
  if (reasons.length > 0) {
    console.log(`   FILTERED OUT because:`);
    reasons.forEach(r => console.log(`     ${r}`));
  } else {
    console.log(`   ✅ Should be ready for messaging!`);
  }
  
  console.log();
});

// Check what execute-live would see
console.log('📊 EXECUTABLE PROSPECTS (execute-live criteria):');
console.log('   Filters:');
console.log('   - status IN (pending, approved, ready_to_message)');
console.log('   - linkedin_url IS NOT NULL');
console.log('   - contacted_at IS NULL\n');

const executable = allProspects.filter(p => 
  ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
  p.linkedin_url &&
  !p.contacted_at
);

console.log(`Executable count: ${executable.length}\n`);

if (executable.length > 0) {
  console.log('✅ These prospects SHOULD be executable:');
  executable.forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name}`);
  });
} else {
  console.log('❌ NO PROSPECTS PASS THE FILTERS\n');
  console.log('Possible causes:');
  console.log('1. All prospects already contacted (contacted_at is set)');
  console.log('2. Wrong status (not pending/approved/ready_to_message)');
  console.log('3. Missing LinkedIn URLs');
  console.log('4. Bug in execute-live route filtering logic');
}

// Check LinkedIn account
console.log('\n🔗 LINKEDIN ACCOUNT CHECK:');
const { data: linkedinAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('account_type', 'linkedin')
  .single();

if (linkedinAccount) {
  console.log(`✅ LinkedIn account connected`);
  console.log(`   Account ID: ${linkedinAccount.unipile_account_id}`);
  console.log(`   Status: ${linkedinAccount.status || 'N/A'}`);
} else {
  console.log('❌ No LinkedIn account found!');
}
